export const config =
  process.env.NODE_ENV === 'production'
    ? {
        production: true,
        gae: true,
      }
    : {
        production: false,
        gae: false,
      };
