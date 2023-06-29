import { InstancesClient, InstanceTemplatesClient, ZoneOperationsClient } from '@google-cloud/compute';
import { format } from 'date-fns';
import { environment } from '../../environments/environment';

// Zones with N1 machines (proxy are f1-micro)
// See https://cloud.google.com/compute/docs/regions-zones
const ZONES = [
  'us-central1-a',
  'europe-west1-c',
  'southamerica-east1-c',
  'us-west1-a',
  'asia-northeast1-a',
  'us-east1-b',
  'asia-southeast2-c',
  'us-west2-a', // Fails 2023-06
  'europe-north1-a',
  'us-east4-a', // Fails 2023-06
  'us-west4-a', // Fails 2023-06
  'asia-east1-a',
];
const PROJECT = 'fly-xc';
const TEMPLATE = 'proxy-tmpl';
const SUBNETORK = 'https://www.googleapis.com/compute/v1/projects/fly-xc/regions/{region}/subnetworks/default';

export class Proxies {
  // Instance name.
  private name: string | null | undefined;
  // Instance IP.
  private ip: string | null | undefined;
  private logs: string[] = [];
  // Instance label.
  private label: string;
  // Zone index.
  private zoneIndex = 0;
  private killingZombies = false;

  constructor(label: string) {
    this.label = `${environment.production ? '' : 'dev-'}${label}`;
  }

  // Starts a proxy server.
  public async start() {
    this.name = format(new Date(), "'proxy-'yyyyMMdd-HHmmss");
    this.ip = null;
    const zone = this.getNextZone();

    try {
      const instanceTemplatesClient = new InstanceTemplatesClient();

      const [instanceTemplate] = await instanceTemplatesClient.get({
        project: PROJECT,
        instanceTemplate: TEMPLATE,
      });

      const networkInterfaces = instanceTemplate.properties?.networkInterfaces;

      if (networkInterfaces && Array.isArray(networkInterfaces)) {
        networkInterfaces[0].subnetwork = SUBNETORK.replace('{region}', zone.slice(0, -2));
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
        if (Array.isArray(instance?.networkInterfaces) && Array.isArray(instance.networkInterfaces[0]?.accessConfigs)) {
          // Use the external IP in dev.
          this.ip = environment.gae
            ? instance.networkInterfaces[0].networkIP
            : instance.networkInterfaces[0].accessConfigs[0].natIP;
        } else {
          console.error(`Proxies ${this.label}: can not retrieve IP`);
          this.name = null;
        }
      } else {
        console.error(`Proxies ${this.label}: op error ${JSON.stringify(operation.error)}`);
        this.name = null;
      }
    } catch (e) {
      console.error(`Proxies ${this.label}: ${e}`);
      this.name = null;
    }

    if (this.name != null) {
      this.log(`Started ${this.label} ${this.name} in ${zone} (${this.ip})`);
    } else {
      this.log(`Failed to start ${this.label} in ${zone}`);
    }
  }

  // Kills unused proxy servers.
  public async killZombies(): Promise<boolean> {
    if (this.killingZombies) {
      return true;
    }
    this.killingZombies = true;
    let success = true;
    try {
      const instancesClient = new InstancesClient();

      const aggListRequest = instancesClient.aggregatedListAsync({
        project: PROJECT,
        maxResults: 10,
        filter: `labels.proxy:${this.label}`,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const [_, instancesObject] of aggListRequest) {
        const instances = instancesObject.instances;

        if (instances && instances.length > 0) {
          for (const instance of instances) {
            if (instance.name == this.name) {
              // Do not kill the active proxy.
              continue;
            }

            // instance.zone is returned as
            // https://www.googleapis.com/compute/v1/projects/fly-xc/zones/us-west1
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

  public getIp() {
    return this.ip;
  }

  public isReadyOrStart(): boolean {
    if (this.name == null) {
      // No proxy starting, start one.
      this.start();
      return false;
    }
    if (this.ip == null) {
      // Waiting for a proxy to be ready.
      return false;
    }
    return true;
  }

  public detachCurrent(): boolean {
    const hasCurrent = this.name != null;
    this.name = null;
    this.ip = null;
    return hasCurrent;
  }

  public flushLogs(): string[] {
    const logs = [...this.logs];
    this.logs.length = 0;
    return logs;
  }

  private log(msg: string) {
    this.logs.push(`[${Math.round(Date.now() / 1000)}] ${msg}`);
  }

  private getNextZone() {
    const zone = ZONES[this.zoneIndex];
    this.zoneIndex = (this.zoneIndex + 1) % ZONES.length;
    return zone;
  }
}
