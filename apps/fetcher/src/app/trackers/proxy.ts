import { once } from 'node:events';
import net from 'node:net';

import { InstancesClient, InstanceTemplatesClient, ZoneOperationsClient } from '@google-cloud/compute';
import { format } from 'date-fns';
import { ProxyAgent } from 'undici';

import { config } from '../config';

/**
 * Google Cloud zones supporting N1 machine types (f1-micro instances).
 * Verified via live VM creation probes. Cycles through these zones round-robin
 * across diverse geographic regions to obtain distinct external IP addresses.
 *
 * @see https://cloud.google.com/compute/docs/regions-zones
 */
const ZONES = [
  'us-central1-b',
  'us-east4-a',
  'asia-southeast2-c',
  'asia-east1-a',
  'us-west1-b',
  'europe-west1-c',
  'asia-southeast1-b',
  'us-east1-b',
  'asia-east1-b',
  'us-east4-b',
  'europe-west1-d',
  'europe-west1-b',
];

const PROJECT = 'fly-xc';
const TEMPLATE = 'proxy-tmpl';
const SUBNETWORK = 'https://www.googleapis.com/compute/v1/projects/fly-xc/regions/{region}/subnetworks/default';

/**
 * Manages ephemeral Google Compute Engine (GCE) proxy instances.
 *
 * Used by tracker fetchers (e.g., InReach) to rotate outbound IP addresses when
 * upstream APIs return HTTP 429 rate-limit responses. Spawns temporary `f1-micro`
 * instances across global zones from an instance template, extracts their IP,
 * and cleans up terminated or obsolete "zombie" VMs.
 */
export class Proxy {
  /** Active GCE instance name, or null/undefined if none is active or starting. */
  private name: string | null | undefined;

  /** External (or App Engine internal) IP address of the active proxy instance. */
  private ip: string | null | undefined;

  /** Cached ProxyAgent dispatcher pointing to the active proxy instance. */
  private dispatcher: ProxyAgent | null = null;

  /** Whether the proxy container is confirmed to be accepting connections on port 80. */
  private isReady = false;

  /** Monotonically increasing lifecycle generation to detect and discard stale probe results. */
  private generation = 0;

  /** Buffered log messages for Redis/diagnostic inspection. */
  private logs: string[] = [];

  /** Label applied to GCE instances for lifecycle tracking and zombie cleanup. */
  private label: string;

  /** Index of the current zone in the round-robin ZONES array. */
  private zoneIndex = 0;

  /** Guard to prevent concurrent zombie cleanup operations. */
  private killingZombies = false;

  /**
   * Creates a new Proxies manager.
   *
   * @param label - Base label identifying the tracker (e.g. `'inreach'`).
   *                Prefixed with `'dev-'` in non-production environments.
   */
  constructor(label: string) {
    this.label = `${config.production ? '' : 'dev-'}${label}`;
  }

  /**
   * Starts a new ephemeral proxy VM in the next round-robin zone.
   *
   * Provisions an instance using the GCE instance template `proxy-tmpl`,
   * waits for the insertion operation to finish, and extracts the instance's IP.
   */
  public async start(maxAttempts = 3): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.name = format(new Date(), "'proxy-'yyyyMMdd-HHmmss");
      this.ip = null;
      this.isReady = false;
      this.generation++;
      this.closeDispatcher();
      const zone = this.getNextZone();

      try {
        const instanceTemplatesClient = new InstanceTemplatesClient();

        const [instanceTemplate] = await instanceTemplatesClient.get({
          project: PROJECT,
          instanceTemplate: TEMPLATE,
        });

        const networkInterfaces = instanceTemplate.properties?.networkInterfaces;

        if (networkInterfaces && Array.isArray(networkInterfaces)) {
          networkInterfaces[0].subnetwork = SUBNETWORK.replace('{region}', zone.slice(0, -2));
        }

        const instancesClient = new InstancesClient();

        const [response] = await instancesClient.insert({
          project: PROJECT,
          zone,
          instanceResource: {
            name: this.name,
            labels: { proxy: this.label },
            networkInterfaces,
          },
          sourceInstanceTemplate: instanceTemplate.selfLink,
        });

        let operation = response.latestResponse as any;
        const operationsClient = new ZoneOperationsClient();

        while (operation.status != 'DONE') {
          [operation] = await operationsClient.wait({
            operation: operation.name,
            project: PROJECT,
            zone,
          });
        }

        if (operation.error == null) {
          const [instance] = await instancesClient.get({
            project: PROJECT,
            zone,
            instance: this.name,
          });
          if (
            Array.isArray(instance?.networkInterfaces) &&
            Array.isArray(instance.networkInterfaces[0]?.accessConfigs)
          ) {
            // Use internal network IP when running on App Engine, otherwise external NAT IP.
            this.ip = config.gae
              ? instance.networkInterfaces[0].networkIP
              : instance.networkInterfaces[0].accessConfigs[0].natIP;
            this.log(`Started ${this.label} ${this.name} in ${zone} (${this.ip})`);
            return;
          } else {
            console.error(`Proxies ${this.label}: can not retrieve IP`);
            this.name = null;
          }
        } else {
          console.error(`Proxies ${this.label}: op error in ${zone}: ${JSON.stringify(operation.error)}`);
          this.name = null;
        }
      } catch (e) {
        console.error(`Proxies ${this.label}: ${e}`);
        this.name = null;
      }

      this.log(`Failed to start ${this.label} in ${zone}`);
    }
  }

  /**
   * Discovers and terminates obsolete ("zombie") proxy instances.
   *
   * Scans all zones for VMs bearing this manager's label and deletes any
   * instance whose name does not match the currently active proxy.
   *
   * @returns `true` if all zombie deletions succeeded, `false` if any error occurred.
   */
  public async killZombies(): Promise<boolean> {
    if (this.killingZombies) {
      return true;
    }
    this.killingZombies = true;
    let success = true;
    try {
      const instancesClient = new InstancesClient();

      const aggListRequest = instancesClient.aggregatedListAsync(
        {
          project: PROJECT,
          maxResults: 10,
          filter: `labels.proxy:${this.label}`,
        },
        {
          autoPaginate: false,
        },
      );

      for await (const [_, instancesObject] of aggListRequest) {
        const instances = instancesObject.instances;

        if (instances && instances.length > 0) {
          for (const instance of instances) {
            if (instance.name == this.name) {
              // Do not kill the active proxy.
              continue;
            }

            // instance.zone is returned as https://www.googleapis.com/compute/v1/projects/.../zones/<zone>
            let zone = instance.zone ?? ZONES[0];
            const index = zone.lastIndexOf('/');
            zone = index > -1 ? zone.substring(index + 1) : zone;

            const [response] = await instancesClient.delete({
              project: PROJECT,
              zone,
              instance: instance.name,
            });

            let operation = response.latestResponse as any;
            const operationsClient = new ZoneOperationsClient();

            while (operation.status != 'DONE') {
              [operation] = await operationsClient.wait({
                operation: operation.name,
                project: PROJECT,
                zone,
              });
            }

            if (operation.error == null) {
              this.log(`Stopped ${this.label} ${instance.name}`);
            } else {
              console.error(`Failed to stop ${this.label} ${instance.name} ${JSON.stringify(operation.error)}`);
              this.log(`Failed to stop ${this.label} ${instance.name} in ${zone}`);
              success = false;
            }
          }
        }
      }
    } catch (e) {
      this.log(`Failed to stop ${this.label} ${e}`);
      console.error(`Failed to stop ${this.label} ${e}`);
      success = false;
    } finally {
      this.killingZombies = false;
    }

    return success;
  }

  /**
   * Returns the IP address of the active proxy instance.
   *
   * @returns The IP address string, or `null`/`undefined` if the proxy is not ready.
   */
  public getIp(): string | null | undefined {
    return this.ip;
  }

  /**
   * Checks whether the proxy is ready to handle requests without blocking.
   *
   * 1. If no proxy has been requested yet (`name == null`), triggers {@link start}
   *    asynchronously in the background and returns `false`.
   * 2. If the VM is still being provisioned by GCE (`ip == null`), returns `false`.
   * 3. If already verified ready, returns `true` immediately.
   * 4. If the IP is known but not yet verified, performs a single non-blocking
   *    TCP connection probe to port 80 (timeout: 1000ms).
   *    - If port 80 connects: sets `isReady = true`, logs readiness, returns `true`.
   *    - If refused or timed out: logs unreachable and returns `false`.
   *
   * @returns `true` if the VM is running and its proxy container is accepting connections on port 80; `false` otherwise.
   */
  public async isReadyOrStart(): Promise<boolean> {
    if (this.name == null) {
      // No proxy starting, start one.
      this.start();
      return false;
    }
    if (this.ip == null) {
      // Waiting for a proxy to be ready.
      return false;
    }
    if (this.isReady) {
      return true;
    }

    return await this.checkProxyReady();
  }

  /**
   * Probes whether the proxy is accepting TCP connections and updates `isReady`.
   *
   * @param port - Port to connect to (default 80).
   * @param timeoutMs - Connection timeout in milliseconds (default 1000).
   * @returns `true` if connected successfully; `false` on error or timeout.
   */
  protected async checkProxyReady(port = 80, timeoutMs = 1000): Promise<boolean> {
    if (!this.ip) {
      return false;
    }
    const expectedGeneration = this.generation;
    const socket = net.connect({ host: this.ip, port });
    try {
      await once(socket, 'connect', { signal: AbortSignal.timeout(timeoutMs) });
      if (this.generation === expectedGeneration) {
        this.isReady = true;
      }
    } catch {
      if (this.generation === expectedGeneration) {
        this.isReady = false;
        this.log(`Proxy ${this.name} (${this.ip}) unreachable`);
      }
    } finally {
      socket.destroy();
    }
    return this.generation === expectedGeneration && this.isReady;
  }

  /**
   * Returns a cached Undici ProxyAgent configured for the active proxy IP.
   *
   * @returns ProxyAgent instance, or `undefined` if the proxy is not ready.
   */
  public getDispatcher(): ProxyAgent | undefined {
    if (!this.ip) {
      return undefined;
    }
    if (!this.dispatcher) {
      this.dispatcher = new ProxyAgent({
        uri: `http://${this.ip}:80`,
        token: `Bearer ${SECRETS.PROXY_KEY}`,
      });
    }
    return this.dispatcher;
  }

  /**
   * Detaches the active proxy reference so subsequent calls will not route through it,
   * making it eligible for cleanup via {@link killZombies}.
   *
   * @returns `true` if an active proxy was attached, `false` otherwise.
   */
  public detachCurrent(): boolean {
    const hasCurrent = this.name != null;
    this.name = null;
    this.ip = null;
    this.isReady = false;
    this.generation++;
    this.closeDispatcher();
    return hasCurrent;
  }

  /**
   * Closes the cached ProxyAgent dispatcher and resets its reference.
   */
  private closeDispatcher(): void {
    if (this.dispatcher) {
      this.dispatcher.close().catch(() => undefined);
      this.dispatcher = null;
    }
  }

  /**
   * Flushes and clears all accumulated diagnostic logs.
   *
   * @returns Array of timestamped log strings.
   */
  public flushLogs(): string[] {
    const logs = [...this.logs];
    this.logs.length = 0;
    return logs;
  }

  /**
   * Records a timestamped message into the diagnostic log buffer.
   *
   * @param msg - Log message text.
   */
  private log(msg: string): void {
    this.logs.push(`[${Math.round(Date.now() / 1000)}] ${msg}`);
  }

  /**
   * Selects the next zone in round-robin sequence.
   *
   * @returns GCE zone name (e.g. `'us-central1-a'`).
   */
  private getNextZone(): string {
    const zone = ZONES[this.zoneIndex];
    this.zoneIndex = (this.zoneIndex + 1) % ZONES.length;
    return zone;
  }
}
