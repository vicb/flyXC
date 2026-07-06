export const config =
  process.env.NODE_ENV === 'production'
    ? {
        production: true,
        gae: true,
        https: true,
        oauthOrigin: 'https://api.flyxc.app',
        cookieDomain: '.flyxc.app',
        cookieName: 'fxc-session',
        // Allowed domains.
        corsAllowList: ['flyxc.app', '.flyxc.pages.dev'],
      }
    : {
        production: false,
        gae: false,
        https: false,
        oauthOrigin: 'http://localhost:8080',
        cookieDomain: undefined,
        cookieName: 'fxc-session',
        // Allowed domains.
        corsAllowList: ['localhost'],
      };
