const { composePlugins, withNx } = require('@nx/webpack');
const TerserPlugin = require('terser-webpack-plugin');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
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
