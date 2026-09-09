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
});
