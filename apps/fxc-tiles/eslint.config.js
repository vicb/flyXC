const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['src/assets/airspaces/tiles/*'],
  },
];
