import {
  validateFlymasterAccount,
  validateInreachAccount,
  validateMeshBirAccount,
  validateOgnAccount,
  validateSkylinesAccount,
  validateSpotAccount,
  validateXContestAccount,
  validateZoleoAccount,
} from './models';

describe('Validate Inreach account', () => {
  test('Valid urls', () => {
    expect(validateInreachAccount('https://share.garmin.com/user')).toBe('https://share.garmin.com/Feed/Share/user');
    expect(validateInreachAccount('https://share.garmin.com/Feed/Share/user')).toBe(
      'https://share.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('https://share.garmin.com/feed/share/user')).toBe(
      'https://share.garmin.com/feed/share/user',
    );

    expect(validateInreachAccount('http://share.garmin.com/user')).toBe('http://share.garmin.com/Feed/Share/user');
    expect(validateInreachAccount('http://share.garmin.com/Feed/Share/user')).toBe(
      'http://share.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('http://share.garmin.com/feed/share/user')).toBe(
      'http://share.garmin.com/feed/share/user',
    );

    expect(validateInreachAccount('https://inreach.garmin.com/user')).toBe(
      'https://inreach.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('https://inreach.garmin.com/Feed/Share/user')).toBe(
      'https://inreach.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('https://inreach.garmin.com/feed/share/user')).toBe(
      'https://inreach.garmin.com/feed/share/user',
    );

    expect(validateInreachAccount('https://eur-share.inreach.garmin.com/user')).toBe(
      'https://eur-share.inreach.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('https://eur-share.inreach.garmin.com/Feed/Share/user')).toBe(
      'https://eur-share.inreach.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('https://eur-share.inreach.garmin.com/feed/share/user')).toBe(
      'https://eur-share.inreach.garmin.com/feed/share/user',
    );
    expect(validateInreachAccount('share.garmin.com/user')).toBe('https://share.garmin.com/Feed/Share/user');
    expect(validateInreachAccount('share.garmin.com/Feed/Share/user')).toBe('https://share.garmin.com/Feed/Share/user');
    expect(validateInreachAccount('share.garmin.com/feed/share/user')).toBe('https://share.garmin.com/feed/share/user');

    // Trim
    expect(validateInreachAccount('  https://share.garmin.com/user  ')).toBe(
      'https://share.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('  https://share.garmin.com/Feed/Share/user  ')).toBe(
      'https://share.garmin.com/Feed/Share/user',
    );
    expect(validateInreachAccount('  https://share.garmin.com/feed/share/user  ')).toBe(
      'https://share.garmin.com/feed/share/user',
    );

    // Protocol and host should be lower case (ENOTFOUND error otherwise)
    expect(validateInreachAccount('HTTPS://share.garmin.com/user')).toBe('https://share.garmin.com/Feed/Share/user');
    expect(validateInreachAccount('HTTPS://share.garmin.com/FEED/Share/user')).toBe(
      'https://share.garmin.com/FEED/Share/user',
    );
  });

  test('Invalid urls', () => {
    expect(validateInreachAccount('user')).toEqual(false);
    expect(validateInreachAccount('https://share.gmin.com/user')).toEqual(false);
    expect(validateInreachAccount('https://share.garmin/com/user')).toEqual(false);
  });
});

describe('Validate Skylines accounts', () => {
  test('Valid ids', () => {
    expect(validateSkylinesAccount('0')).toBe('0');
    expect(validateSkylinesAccount('123')).toBe('123');
    expect(validateSkylinesAccount('00123')).toBe('00123');
    expect(validateSkylinesAccount('  0  ')).toBe('0');
  });

  test('Invalid ids', () => {
    expect(validateSkylinesAccount('')).toEqual(false);
    expect(validateSkylinesAccount('0a')).toEqual(false);
    expect(validateSkylinesAccount('a123')).toEqual(false);
    expect(validateSkylinesAccount('random')).toEqual(false);
  });
});

describe('Validate Spot accounts', () => {
  test('valid ids', () => {
    expect(validateSpotAccount('0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq')).toEqual('0onlLopfoM4bG5jXvWRE8H0Obd0oMxMBq');
    expect(validateSpotAccount('0eqU3fCbXmYJqn4bd8Q21xidWisSxpNoK')).toEqual('0eqU3fCbXmYJqn4bd8Q21xidWisSxpNoK');
    expect(validateSpotAccount('  0eqU3fCbXmYJqn4bd8Q21xidWisSxpNoK  ')).toEqual('0eqU3fCbXmYJqn4bd8Q21xidWisSxpNoK');
  });

  test('invalid ids', () => {
    expect(validateSpotAccount('0-2462937')).toEqual(false);
    expect(validateSpotAccount('random')).toEqual(false);
  });
});

describe('Validate Flymaster accounts', () => {
  test('Valid ids', () => {
    expect(validateFlymasterAccount('123')).toBe('123');
    expect(validateFlymasterAccount('00123')).toBe('00123');
    expect(validateFlymasterAccount('  123  ')).toBe('123');
  });

  test('Invalid ids', () => {
    expect(validateFlymasterAccount('')).toEqual(false);
    expect(validateFlymasterAccount('1')).toEqual(false);
    expect(validateFlymasterAccount('12')).toEqual(false);
    expect(validateFlymasterAccount('0a')).toEqual(false);
    expect(validateFlymasterAccount('a123')).toEqual(false);
    expect(validateFlymasterAccount('random')).toEqual(false);
  });
});

describe('Validate OGN accounts', () => {
  test('Valid ids', () => {
    expect(validateOgnAccount('123456')).toBe('123456');
    expect(validateOgnAccount('abcdef')).toBe('ABCDEF');
    expect(validateOgnAccount('ABCDEF')).toBe('ABCDEF');
    expect(validateOgnAccount('  123ABC  ')).toBe('123ABC');
  });

  test('Invalid ids', () => {
    expect(validateOgnAccount('')).toEqual(false);
    expect(validateOgnAccount('12345')).toEqual(false);
    expect(validateOgnAccount('1234567')).toEqual(false);
    expect(validateOgnAccount('random')).toEqual(false);
  });
});

describe('Validate zoleo accounts', () => {
  test('Valid ids', () => {
    expect(validateZoleoAccount('012345678912345')).toBe('012345678912345');
    expect(validateZoleoAccount('  012345678912345  ')).toBe('012345678912345');
  });

  test('Invalid ids', () => {
    expect(validateZoleoAccount('')).toEqual(false);
    expect(validateZoleoAccount('01234567891234')).toEqual(false);
    expect(validateZoleoAccount('0123456789123456')).toEqual(false);
    expect(validateZoleoAccount('random')).toEqual(false);
  });
});

describe('Validate xcontest accounts', () => {
  test('Valid ids', () => {
    expect(validateXContestAccount('a123456789012345678901234567')).toBe('a123456789012345678901234567');
    expect(validateXContestAccount('kUgsHrVb3TSwVp23o9P1LsEaIWPZ')).toBe('kUgsHrVb3TSwVp23o9P1LsEaIWPZ');
    expect(validateXContestAccount('  kUgsHrVb3TSwVp23o9P1LsEaIWPZ  ')).toBe('kUgsHrVb3TSwVp23o9P1LsEaIWPZ');
  });

  test('Invalid ids', () => {
    expect(validateXContestAccount('')).toEqual(false);
    expect(validateXContestAccount('0123456789012345678901234567')).toEqual(false);
    expect(validateXContestAccount('UgsHrVb3TSwVp23o9P1LsEaIWPZ')).toEqual(false);
    expect(validateXContestAccount(' UgsHrVb3TSwVp23o9P1LsEaIWPZ ')).toEqual(false);
  });
});

describe('Validate meshbir accounts', () => {
  test('Valid ids', () => {
    expect(validateMeshBirAccount('aa752cea-8222-5bc8-acd9-123b090c0ccb')).toBe('AA752CEA-8222-5BC8-ACD9-123B090C0CCB');
    expect(validateMeshBirAccount('aa752cEa-8222-5Bc8-acd9-123B090c0ccb')).toBe('AA752CEA-8222-5BC8-ACD9-123B090C0CCB');
    expect(validateMeshBirAccount('  aa752cea-8222-5bc8-acd9-123b090c0ccb  ')).toBe(
      'AA752CEA-8222-5BC8-ACD9-123B090C0CCB',
    );
  });

  test('Invalid ids', () => {
    expect(validateMeshBirAccount('')).toEqual(false);
    expect(validateMeshBirAccount('0123456789012345678901234567')).toEqual(false);
    expect(validateMeshBirAccount('UgsHrVb3TSwVp23o9P1LsEaIWPZ')).toEqual(false);
    expect(validateMeshBirAccount(' UgsHrVb3TSwVp23o9P1LsEaIWPZ ')).toEqual(false);
  });
});
