const { composePlugins, withNx } = require('@nx/webpack');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const fs = require('node:fs');
const { parse } = require('@dotenvx/dotenvx');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  const secretsPath = 'secrets.env.local';
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

  // Do not minimize the assets.
  // The JS files are already minified (fxc-front).
  // Also bug in terser: https://github.com/terser/terser/issues/1412
  if (config.optimization?.minimizer) {
    config.optimization.minimizer = [
      new TerserPlugin({
        parallel: true,
        exclude: 'static',
      }),
    ];
  }

  return config;
});
