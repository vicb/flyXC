const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@dotenvx/dotenvx');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  const secretsPath = path.join(__dirname, '../../secrets.env.local');
  /** @type {Record<string, string>} */
  const secrets = {};

  if (!fs.existsSync(secretsPath)) {
    throw new Error(`Secrets file not found at path: ${secretsPath}`);
  }

  const envConfig = parse(fs.readFileSync(secretsPath, 'utf-8'));

  for (const [key, value] of Object.entries(envConfig)) {
    secrets[`SECRETS.${key}`] = JSON.stringify(value);
  }

  config.plugins = config.plugins || [];
  config.plugins.push(new webpack.DefinePlugin(secrets));

  // Mark @google-cloud packages as external to avoid bundling them
  // This prevents issues with dynamic file loading (e.g., proto files)
  config.externals = config.externals || [];
  if (Array.isArray(config.externals)) {
    config.externals.push(/^@google-cloud\/.*/);
  }

  return config;
});
