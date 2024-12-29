const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['**/.vite', '**/node_modules', '**/.cache'],
  },
];
