/* eslint-disable */
export default {
  displayName: 'run',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.bench.json',
    },
  },
  testEnvironment: 'jest-bench/environment',
  testEnvironmentOptions: {
    testEnvironment: 'jest-environment-node',
    testEnvironmentOptions: {},
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/run',
  testMatch: ['**/?(*.)+(bench).[jt]s?(x)'],
  reporters: ['default', 'jest-bench/reporter'],
};
