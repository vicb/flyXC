import net from 'node:net';

import { fetch as undiciFetch, ProxyAgent } from 'undici';
import undiciPkg from 'undici/package.json';
import { describe, expect, it } from 'vitest';

import { Proxy } from './proxy';

describe('Proxy & Dispatcher compatibility', () => {
  it('returns undefined dispatcher when proxy IP is not ready', () => {
    const proxy = new Proxy('inreach');
    expect(proxy.getDispatcher()).toBeUndefined();
  });

  it('ensures installed undici major version matches Node embedded undici version', () => {
    // Node.js embeds its own copy of undici for globalThis.fetch, reported in process.versions.undici.
    // If undici is bumped to a new major version ahead of Node (or vice versa), the internal
    // Dispatcher interface contracts can diverge.
    const nodeUndiciVersion = process.versions.undici;
    expect(nodeUndiciVersion, 'process.versions.undici should be defined in Node.js').toBeDefined();

    const nodeMajor = nodeUndiciVersion.split('.')[0];
    const installedMajor = undiciPkg.version.split('.')[0];

    expect(
      installedMajor,
      `Installed undici (${undiciPkg.version}) major version does not match Node's embedded undici (${nodeUndiciVersion}). ` +
        `Align undici in pnpm-workspace.yaml with Node's version.`,
    ).toBe(nodeMajor);
  });

  it('undici.fetch accepts ProxyAgent without throwing internal dispatcher contract errors', async () => {
    expect.hasAssertions();
    // Verifies that undici.fetch and ProxyAgent from the same npm package share the same dispatcher protocol.
    // When pointing to a closed local port, it should fail with a network error (e.g. ECONNREFUSED)
    // and NEVER throw an internal dispatcher mismatch (e.g. "invalid onRequestStart method").
    const agent = new ProxyAgent('http://127.0.0.1:65534');
    try {
      await undiciFetch('http://127.0.0.1:65534', {
        dispatcher: agent,
        signal: AbortSignal.timeout(100),
      });
    } catch (e: any) {
      expect(e?.cause?.name).not.toBe('InvalidArgumentError');
      expect(e?.cause?.message).not.toMatch(/onRequestStart/i);
    }
  });

  describe('isReadyOrStart & TCP readiness probe', () => {
    it('returns false when proxy is not started and triggers start()', async () => {
      const proxy = new Proxy('inreach');
      const startSpy = vi.spyOn(proxy, 'start').mockResolvedValue(undefined);
      const ready = await proxy.isReadyOrStart();
      expect(ready).toBe(false);
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it('returns false when proxy name is set but IP is null', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-20260909-120000';
      (proxy as any).ip = null;
      const ready = await proxy.isReadyOrStart();
      expect(ready).toBe(false);
    });

    it('delegates to checkProxyReady and returns false when proxy is not ready', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-20260909-120000';
      (proxy as any).ip = '127.0.0.1';

      const checkProxyReadySpy = vi.spyOn(proxy as any, 'checkProxyReady').mockResolvedValue(false);

      const ready = await proxy.isReadyOrStart();
      expect(ready).toBe(false);
      expect(checkProxyReadySpy).toHaveBeenCalled();
    });

    it('returns true, caches isReady, and enables dispatcher when port 80 connects', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-20260909-120000';
      (proxy as any).ip = '127.0.0.1';

      const checkProxyReadySpy = vi.spyOn(proxy as any, 'checkProxyReady').mockImplementation(async () => {
        (proxy as any).isReady = true;
        return true;
      });

      const ready = await proxy.isReadyOrStart();
      expect(ready).toBe(true);
      expect(proxy.getDispatcher()).toBeDefined();
      expect(proxy.flushLogs()).toEqual([]);

      // Subsequent call should return true from cache without calling checkProxyReady again
      expect(await proxy.isReadyOrStart()).toBe(true);
      expect(checkProxyReadySpy).toHaveBeenCalledTimes(1);
    });

    it('checkProxyReady accurately verifies real TCP connectivity and updates isReady', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-20260909-120000';
      (proxy as any).ip = '127.0.0.1';

      // Test against an open local port
      const server = net.createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as net.AddressInfo).port;

      try {
        expect(await (proxy as any).checkProxyReady(port, 500)).toBe(true);
        expect((proxy as any).isReady).toBe(true);
      } finally {
        server.close();
      }

      // Test against a closed local port
      expect(await (proxy as any).checkProxyReady(65534, 100)).toBe(false);
      expect((proxy as any).isReady).toBe(false);
      expect(proxy.flushLogs()).toEqual(expect.arrayContaining([expect.stringContaining('unreachable')]));
    });

    it('resets isReady on detachCurrent', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-20260909-120000';
      (proxy as any).ip = '127.0.0.1';
      (proxy as any).isReady = true;

      expect(proxy.detachCurrent()).toBe(true);
      expect((proxy as any).isReady).toBe(false);
      expect(proxy.getDispatcher()).toBeUndefined();
    });

    it('discards stale probe result when start() replaces proxy before probe settles', async () => {
      const proxy = new Proxy('inreach');
      (proxy as any).name = 'proxy-vm-1';
      (proxy as any).ip = '10.0.0.1';

      let finishProbe1!: () => void;
      const probe1Promise = new Promise<void>((resolve) => {
        finishProbe1 = resolve;
      });

      let connectCalls = 0;
      vi.spyOn(net, 'connect').mockImplementation(() => {
        connectCalls++;
        const socket = new net.Socket();
        if (connectCalls === 1) {
          probe1Promise.then(() => socket.emit('connect'));
        }
        return socket;
      });

      // 1. Launch probe for proxy VM-1
      const probe1 = (proxy as any).checkProxyReady();

      // 2. Interleave: proxy is replaced (as start() does) while probe 1 is in-flight
      (proxy as any).name = 'proxy-vm-2';
      (proxy as any).ip = '10.0.0.2';
      (proxy as any).isReady = false;
      (proxy as any).generation++;

      // 3. Probe 1 completes after replacement
      finishProbe1();
      const probe1Result = await probe1;

      // 4. Stale probe result is discarded; VM-2 is NOT marked ready
      expect(probe1Result).toBe(false);
      expect((proxy as any).isReady).toBe(false);

      // 5. Subsequent isReadyOrStart() does not skip validation of VM-2
      const checkProxyReadySpy = vi.spyOn(proxy as any, 'checkProxyReady').mockResolvedValue(false);
      const readyForVm2 = await proxy.isReadyOrStart();
      expect(readyForVm2).toBe(false);
      expect(checkProxyReadySpy).toHaveBeenCalledTimes(1);
    });
  });
});
