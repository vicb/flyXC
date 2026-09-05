// Client for the OGN APRS server

import { Socket } from 'node:net';
import type { Interface } from 'node:readline';
import readline from 'node:readline';

import type { AprsPosition } from '@flyxc/common';
import { parseAprsPosition } from '@flyxc/common';

const VERSION = '1.0';

// Sample messages:
// ICA3C6742>OGADSB,qAS,AVX1100:/181728h5022.93N/00925.77E^223/318/A=011197 !W42! id253C6742 -1280fpm FL105.29 A3:DLH6AX Sq5662
// NAVFE0B52>OGNAVI,qAS,NAVITER2:/181152h4332.89N/11619.14W'000/000/A=002726 !W69! id1C40FE0B52 +000fpm +0.0rot
const MAX_NUM_POSITIONS = 100000;

/**
 * Fast, allocation-minimizing extractor for the 6-character hex OGN device ID.
 * Equivalent to the original regexp: `/\bid[0-9a-z]*?(?<id>[0-9a-z]{6})\b/i`.
 *
 * In OGN APRS beacons, device IDs are formatted as ` id[details][6-hex-id]`
 * (e.g. `id253C6742`, `id1C40FE0B52`) bounded by word boundaries/spaces.
 *
 * High traffic volumes (>1,000 packets/sec) make regular expression execution
 * and named capture object allocation (`match.groups`) a significant source
 * of CPU overhead and V8 GC churn. This direct character scanner avoids both.
 *
 * @param line - Raw APRS beacon line.
 * @returns The 6-character uppercase hex device ID, or `undefined` if not found.
 */
export function fastExtractId(line: string): string | undefined {
  const idx = line.indexOf(' id');
  if (idx === -1) {
    return undefined;
  }
  const start = idx + 3;
  let end = start;
  const len = line.length;
  let hasLower = false;
  while (end < len) {
    const code = line.charCodeAt(end);
    if (code >= 48 && code <= 57) {
      // '0'-'9'
      end++;
    } else if (code >= 65 && code <= 90) {
      // 'A'-'Z'
      end++;
    } else if (code >= 97 && code <= 122) {
      // 'a'-'z'
      hasLower = true;
      end++;
    } else {
      break;
    }
  }
  if (end - start < 6) {
    return undefined;
  }
  const sub = line.substring(end - 6, end);
  return hasLower ? sub.toUpperCase() : sub;
}
const TX_KEEP_ALIVE_MIN = 10;
const MAX_LOG_ENTRIES = 50;

export const OGN_HOST = 'aprs.glidernet.org';
export const OGN_PORT = 14580;

export class OgnClient {
  protected isConnected = false;
  protected socket?: Socket;
  protected readline?: Interface;
  protected trackingIds = new Set<string>();
  protected positions = new Map<string, AprsPosition[]>();
  protected txKeepAliveTimer: NodeJS.Timeout | null = null;
  protected rxKeepAliveSec = 0;
  protected logs: string[] = [];

  constructor(protected host: string, protected port: number, protected user: string, protected password: string) {}

  // Connect (when not connect yet).
  maybeConnect() {
    if (this.isConnected || this.socket?.connecting) {
      return;
    }
    if (!this.socket) {
      this.log(`Socket created`);
      this.socket = new Socket();
      this.socket.on('close', () => {
        this.log(`Socket closed`);
        this.cleanup();
      });
      this.readline = readline.createInterface({ input: this.socket });
      this.txKeepAliveTimer = setInterval(() => this.keepAlive(), TX_KEEP_ALIVE_MIN * 60 * 1000);
      this.rxKeepAliveSec = Date.now() / 1000;
    }
    this.socket.connect(this.port, this.host, () => {
      this.log(`Socket connected`);
      this.isConnected = true;
      this.write(`user ${this.user} pass ${this.password} vers flyxc ${VERSION} filter t/p`);
    });
    this.readline.on('line', (line) => {
      // Skip keep alive lines.
      if (line.startsWith('#')) {
        this.rxKeepAliveSec = Date.now() / 1000;
      } else {
        this.onLine(line);
      }
    });
  }

  disconnect() {
    this.log(`Socket disconnected`);
    this.cleanup();
  }

  // Send a line to the server.
  write(line: string) {
    if (this.rxKeepAliveSec < Date.now() / 1000 - 2 * 60) {
      // We should receive a keep alive every 20 seconds
      this.log(`Keep alive timeout`);
      this.cleanup();
    } else if (this.isConnected) {
      this.socket?.write(line.trim() + '\n');
    } else {
      this.log(`Trying to write while not connected`);
    }
  }

  // Set the list of OGN devices to track.
  registerOgnIds(ids: Set<string>) {
    this.trackingIds.clear();
    for (const id of ids) {
      this.trackingIds.add(id.toUpperCase());
    }
    for (const id of this.positions.keys()) {
      if (!this.trackingIds.has(id)) {
        this.positions.delete(id);
      }
    }
  }

  // Returns the received positions since the last call.
  getAndClearPositions(): Map<string, AprsPosition[]> {
    const positions = new Map(this.positions);
    this.positions.clear();
    return positions;
  }

  // Returns the logs since the last call.
  getAndClearLogs(): string[] {
    return this.logs.splice(0);
  }

  protected onLine(line: string) {
    const id = fastExtractId(line);
    if (id && this.trackingIds.has(id)) {
      // In APRS packets, the position payload begins after the `:/` separator.
      // Equivalent regexp: `/^(?<src>.+?)>.*?:\/(?<position>.*)$/i`
      const posIdx = line.indexOf(':/');
      if (posIdx !== -1) {
        const position = parseAprsPosition(line.substring(posIdx + 2));
        if (position != null && this.positions.size < MAX_NUM_POSITIONS) {
          const positions = this.positions.get(id);
          if (positions == null) {
            this.positions.set(id, [position]);
          } else if (position.timeSec >= positions.at(-1)!.timeSec + 5) {
            // Max 1 point every 5s
            positions.push(position);
          }
        }
      }
    }
  }

  protected cleanup() {
    this.socket?.destroy();
    this.socket = undefined;
    this.readline?.close();
    this.readline = undefined;
    this.isConnected = false;
    if (this.txKeepAliveTimer != null) {
      clearInterval(this.txKeepAliveTimer);
      this.txKeepAliveTimer = null;
    }
  }

  protected keepAlive() {
    this.write('# flyxc.app');
  }

  protected log(entry: string) {
    this.logs.push(entry);
    this.logs.splice(0, this.logs.length - MAX_LOG_ENTRIES);
  }
}
