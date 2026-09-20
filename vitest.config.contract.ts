import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/contract/*.pact.test.ts'],
    globalSetup: ['test/support/global-setup.contract.ts'],
    setupFiles: ['test/support/env.ts'],
    env: {
      TEST_SUITE: 'contract',
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
