const { composePlugins, withNx } = require('@nx/webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
  // See: https://nx.dev/recipes/webpack/webpack-config-setup

  // Environment variables are loaded by Nx.
  // Create a .env.local to overrides the default values in .env
  config.plugins.push(
    new (require('dotenv-webpack'))({
      systemvars: true,
    }),
  );

  return config;
});
