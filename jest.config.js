// See https://github.com/facebook/jest/issues/2081#issuecomment-619441551 for the config.

/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig');

/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
config = {
  // if you're also using typescript
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  // registers babel.config.js with jest
  transform: {
    '^.+\\.js$': 'babel-jest',
    '\\.kml$': 'jest-raw-loader',
    '\\.txt$': 'jest-raw-loader',
  },
  // explicitly include any node libs using ESM modules
  transformIgnorePatterns: ['node_modules/?!(ol)'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  modulePathIgnorePatterns: ['.rollup.cache/'],
};

module.exports = config;
