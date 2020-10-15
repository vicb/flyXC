// Babel is used for the tests.
// See jest.config.js.

module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
};
