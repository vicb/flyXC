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
nx preview windy-plugin-fxc-soundings
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
nx build windy-plugin-fxc-soundings --prod
```

Build for development:

```bash
nx build windy-plugin-fxc-soundings
```

Build everything (production, development, and config files):

```bash
nx upload:prepare windy-plugin-fxc-soundings
```

### Preview

Preview the built plugin:

```bash
nx preview windy-plugin-fxc-soundings
```

## Release

1. Update the plugin version in `package.json`
2. Build the plugin: `nx upload:prepare windy-plugin-fxc-soundings`
3. Upload: `nx upload windy-plugin-fxc-soundings` (requires `WINDY_API_KEY` environment variable)

## References

- [Template for windy plugins](https://github.com/windycom/windy-plugin-template)
- [Windy API documentation](https://docs.windy-plugins.com/)
- [Windy style guide](https://docs.windy-plugins.com/styles/index.html)
