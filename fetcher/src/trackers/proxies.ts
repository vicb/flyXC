import { format } from 'date-fns';
import { InstancesClient, ZoneOperationsClient } from '@google-cloud/compute';

const ZONE = 'us-central1-a';
const PROJECT = 'fly-xc';
const TEMPLATE = 'https://www.googleapis.com/compute/v1/projects/fly-xc/global/instanceTemplates/proxy-tmpl';

export class Proxies {
  // Instance name.
  private name: string | null | undefined;
  // Instance IP.
  private ip: string | null | undefined;
  private logs: string[] = [];
  // Instance label.
  private label: string;

  constructor(label: string) {
    this.label = `${process.env.NODE_ENV == 'development' ? 'dev-' : ''}${label}`;
  }

  // Starts a proxy server.
  public async start() {
    this.name = format(new Date(), "'proxy-'yyyyMMdd-HHmmss");
    this.ip = null;

    try {
      const instancesClient = new InstancesClient();

      const [response] = await instancesClient.insert({
        project: PROJECT,
        zone: ZONE,
        instanceResource: {
          name: this.name,
          labels: { proxy: this.label },
        },
        sourceInstanceTemplate: TEMPLATE,
      });

      let operation = response.latestResponse as any;
      const operationsClient = new ZoneOperationsClient();

      while (operation.status != 'DONE') {
        [operation] = await operationsClient.wait({
          operation: operation.name,
          project: PROJECT,
          zone: ZONE,
        });
      }

      if (operation.error == null) {
        const [instance] = await instancesClient.get({
          project: PROJECT,
          zone: ZONE,
          instance: this.name,
        });
        if (Array.isArray(instance?.networkInterfaces) && Array.isArray(instance.networkInterfaces[0]?.accessConfigs)) {
          // Use the external IP in dev.
          this.ip =
            process.env.NODE_ENV == 'development'
              ? instance.networkInterfaces[0].accessConfigs[0].natIP
              : instance.networkInterfaces[0].networkIP;
        } else {
          console.error(`Proxies ${this.label}: can not retrieve IP`);
          this.name = null;
        }
      } else {
        console.error(`Proxies ${this.label}: op error ${operation.error}`);
        this.name = null;
      }
    } catch (e) {
      console.error(`Proxies ${this.label}: ${e}`);
      this.name = null;
    }

    if (this.name != null) {
      this.log(`Started ${this.label} ${this.name}`);
    } else {
      this.log(`Failed to start ${this.label}`);
    }
  }

  // Kills unused proxy servers.
  public async killZombies(): Promise<boolean> {
    let success = true;
    try {
      const instancesClient = new InstancesClient();

      const aggListRequest = instancesClient.aggregatedListAsync({
        project: PROJECT,
        maxResults: 10,
        filter: `labels.proxy:${this.label}`,
      });

      for await (const [_, instancesObject] of aggListRequest) {
        const instances = instancesObject.instances;

        if (instances && instances.length > 0) {
          for (const instance of instances) {
            if (instance.name == this.name) {
              // Do not kill the active proxy.
              continue;
            }
            const [response] = await instancesClient.delete({
              project: PROJECT,
              zone: ZONE,
              instance: instance.name,
            });

            let operation = response.latestResponse as any;
            const operationsClient = new ZoneOperationsClient();

            while (operation.status != 'DONE') {
              [operation] = await operationsClient.wait({
                operation: operation.name,
                project: PROJECT,
                zone: ZONE,
              });
            }

            if (operation.error == null) {
              this.log(`Stopped ${this.label} ${instance.name}`);
            } else {
              this.log(`Failed to stop ${this.label} ${instance.name}`);
              success = false;
            }
          }
        }
      }
    } catch (e) {
      this.log(`Failed to stop ${this.label}`);
      success = false;
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
}
