import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['**/*/vite.config.ts', '**/*/vitest.config.ts', '!**/dist/workspace_modules/**'],
  },
});
