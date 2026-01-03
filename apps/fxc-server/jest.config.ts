export default {
  displayName: 'fxc-server',
  preset: '../../jest.preset.js',
  globals: {
    // Defined secrets used during tests.
    SECRETS: {
      ADMINS: 'admin',
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/fxc-server',
};
