/* eslint-disable */
export default {
  displayName: 'fetcher',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
    '\\.kml$': './jest.transformer.js',
    '\\.txt$': './jest.transformer.js',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/fetcher',
};
