# windy-plugin-fxc-soundings

The `windy-plugin-fxc-soundings` displays soundings customized for paraglider pilots.

## Development

### Setup

Install dependencies from the project root (pnpm workspace will handle all packages):

```bash
pnpm install
```

### Development Server

Run the development server from the project root:

```bash
pnpm nx serve windy-plugin
```

This will:

- Start the Vite dev server with Hot Module Replacement (HMR)
- Serve the plugin directly at `https://localhost:9999/plugin.js`

Then visit `windy.com/dev` and enter `https://localhost:9999/plugin.js` as the url to the plugin.

Press `Install and open plugin` and the plugin will open to the right side.

When you update components or styles, your changes will be hot-reloaded in the browser automatically via HMR without having to click `Reload plugin`!

> [!TIP]
> Use the `Launch Windy Plugin` launch configuration to debug the plugin in Chrome.

### Building

Build for production (default):

```bash
pnpm nx build windy-plugin
```

Build for development:

```bash
pnpm nx build windy-plugin -c development
```

Build everything (production, development, and config files):

```bash
pnpm nx upload:prepare windy-plugin
```

### Preview

Preview the built plugin:

```bash
pnpm nx preview windy-plugin
```

### Testing and Linting

Run tests:

```bash
pnpm nx test windy-plugin
```

Lint:

```bash
pnpm nx lint windy-plugin
```

## Release

1. Update the plugin version in `package.json`
2. Build the plugin: `pnpm nx upload:prepare windy-plugin`
3. Upload: `pnpm nx upload windy-plugin` (requires `WINDY_API_KEY` environment variable)

## References

- [Template for windy plugins](https://github.com/windycom/windy-plugin-template)
- [Windy API documentation](https://docs.windy-plugins.com/)
- [Windy style guide](https://docs.windy-plugins.com/styles/index.html)
