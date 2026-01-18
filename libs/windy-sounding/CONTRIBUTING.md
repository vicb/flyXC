# windy-plugin-fxc-soundings

The `windy-plugin-fxc-soundings` displays soundings customized for paraglider pilots.

## Development

### Setup

Install dependencies from the project root (pnpm workspace will handle all packages):

```bash
pnpm install
```

### Development Server

Run the preview server with watch mode from the project root:

```bash
pnpm -F windy-plugin-fxc-soundings run preview
```

This will:

- Build both development and production versions
- Start watch mode to automatically rebuild on file changes
- Serve the built plugin at `https://localhost:9999/plugin.js`

Then visit `windy.com/dev` and enter `https://localhost:9999/plugin.js` as the url to the plugin.

Press `Install and open plugin` and the plugin will open to the right side.

When you update the code, the builds will automatically regenerate. Click `Reload plugin` in Windy to load your changes.

> [!TIP]
> Use the `Launch Windy Plugin` launch configuration to debug the plugin in Chrome.

### Building

Build for production:

```bash
pnpm -F windy-plugin-fxc-soundings run build:prod
```

Build for development:

```bash
pnpm -F windy-plugin-fxc-soundings run build:dev
```

Build everything (production, development, and config files):

```bash
pnpm -F windy-plugin-fxc-soundings run upload:prepare
```

### Preview

Preview the built plugin:

```bash
pnpm -F windy-plugin-fxc-soundings run preview
```

## Release

1. Update the plugin version in `package.json`
2. Build the plugin: `pnpm -F windy-plugin-fxc-soundings upload:prepare`
3. Upload: `pnpm -F windy-plugin-fxc-soundings upload` (requires `WINDY_API_KEY` environment variable)

## References

- [Template for windy plugins](https://github.com/windycom/windy-plugin-template)
- [Windy API documentation](https://docs.windy-plugins.com/)
- [Windy style guide](https://docs.windy-plugins.com/styles/index.html)
