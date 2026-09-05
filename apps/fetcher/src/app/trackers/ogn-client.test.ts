import { describe, expect, it } from 'vitest';

import { fastExtractId, OgnClient } from './ogn-client';

describe('fastExtractId', () => {
  it('should extract 6-char hex ID from standard OGN beacons', () => {
    const line =
      'ICA3C6742>OGADSB,qAS,AVX1100:/181728h5022.93N/00925.77E^223/318/A=011197 !W42! id253C6742 -1280fpm FL105.29 A3:DLH6AX Sq5662';
    expect(fastExtractId(line)).toBe('3C6742');
  });

  it('should extract 6-char hex ID from Naviter/SeeYou beacons with longer detail prefixes', () => {
    const line =
      "NAVFE0B52>OGNAVI,qAS,NAVITER2:/181152h4332.89N/11619.14W'000/000/A=002726 !W69! id1C40FE0B52 +000fpm +0.0rot";
    expect(fastExtractId(line)).toBe('FE0B52');
  });

  it('should uppercase lowercase hex characters', () => {
    const line = "SKYF3221C>OGNSKY,qAS,SafeSky:/134809h4410.32N/00630.76E'029/029/A=007732 !W98! id1cf3221c -003fpm";
    expect(fastExtractId(line)).toBe('F3221C');
  });

  it('should return undefined when no id token is present (e.g. receiver status)', () => {
    const line = 'PWHewish>OGNSDR,TCPIP*,qAC,GLIDERN1:/134715h5052.40NI00249.55W&/A=000394';
    expect(fastExtractId(line)).toBeUndefined();
  });

  it('should return undefined when id token is too short', () => {
    const line = 'FOO>BAR:/123456h id123 bar';
    expect(fastExtractId(line)).toBeUndefined();
  });

  it('should handle id token at the end of the line', () => {
    const line = 'FOO>BAR:/123456h4500.00N/00600.00E/000/000/A=001000 id253C6742';
    expect(fastExtractId(line)).toBe('3C6742');
  });
});

class TestOgnClient extends OgnClient {
  public testOnLine(line: string) {
    this.onLine(line);
  }
}

describe('OgnClient onLine parsing', () => {
  it('should parse position only for registered tracking IDs', () => {
    const client = new TestOgnClient('localhost', 14580, 'user', 'pass');
    client.registerOgnIds(new Set(['3C6742']));

    // Line with tracked ID
    client.testOnLine(
      'ICA3C6742>OGADSB,qAS,AVX1100:/181728h5022.93N/00925.77E^223/318/A=011197 !W42! id253C6742 -1280fpm',
    );

    // Line with untracked ID
    client.testOnLine(
      "NAVFE0B52>OGNAVI,qAS,NAVITER2:/181152h4332.89N/11619.14W'000/000/A=002726 !W69! id1C40FE0B52 +000fpm",
    );

    const positions = client.getAndClearPositions();
    expect(positions.has('3C6742')).toBe(true);
    expect(positions.has('FE0B52')).toBe(false);

    const pos = positions.get('3C6742');
    expect(pos).toHaveLength(1);
    expect(pos?.[0].lat).toBeCloseTo(50.3822, 3);
    expect(pos?.[0].lon).toBeCloseTo(9.4295, 3);
  });

  it('should throttle fixes closer than 5 seconds', () => {
    const client = new TestOgnClient('localhost', 14580, 'user', 'pass');
    client.registerOgnIds(new Set(['3C6742']));

    // First fix at 18:17:20
    client.testOnLine('ICA3C6742>OGADSB,qAS,AVX1100:/181720h5022.93N/00925.77E^223/318/A=011197 id253C6742');
    // Fix only 2s later at 18:17:22 (should be ignored)
    client.testOnLine('ICA3C6742>OGADSB,qAS,AVX1100:/181722h5022.95N/00925.79E^223/318/A=011200 id253C6742');
    // Fix 6s later at 18:17:26 (should be kept)
    client.testOnLine('ICA3C6742>OGADSB,qAS,AVX1100:/181726h5022.98N/00925.82E^223/318/A=011210 id253C6742');

    const positions = client.getAndClearPositions().get('3C6742');
    expect(positions).toHaveLength(2);
  });
});
