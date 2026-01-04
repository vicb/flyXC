export default {
  displayName: 'fetcher',
  preset: '../../jest.preset.js',
  globals: {
    SECRETS: {},
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
    '\\.kml$': './jest.transformer.js',
    '\\.txt$': './jest.transformer.js',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/fetcher',
};
