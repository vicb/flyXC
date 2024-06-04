// Client for the OGN APRS server

import type { AprsPosition } from '@flyxc/common';
import { parseAprsPosition } from '@flyxc/common';
import { Socket } from 'node:net';
import type { Interface } from 'node:readline';
import readline from 'node:readline';

const VERSION = '1.0';
const OGN_FAST_ID_REGEXP = /\bid[0-9a-z]{2}(?<id>[0-9a-z]{6})\b/i;
const OGN_POSITION_REGEXP = /^(?<src>.+?)>.*?:\/(?<position>.*)$/i;
const MAX_NUM_POSITIONS = 100000;
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
    // Start by doing a fast check on the id.
    const matchId = line.match(OGN_FAST_ID_REGEXP);
    if (matchId) {
      const id = matchId.groups['id'].toUpperCase();
      // Skip the more expensive regexp if the id should not be tracked.
      if (this.trackingIds.has(id)) {
        const match = line.match(OGN_POSITION_REGEXP);
        if (match) {
          const position = parseAprsPosition(match.groups['position']);
          if (position != null && this.positions.size < MAX_NUM_POSITIONS) {
            const positions = this.positions.get(id);
            if (positions == null) {
              this.positions.set(id, [position]);
            } else {
              positions.push(position);
            }
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
