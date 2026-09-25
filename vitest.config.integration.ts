import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/integration/**/*.integration-spec.ts'],
    globalSetup: ['test/support/global-setup.integration.ts'],
    setupFiles: ['test/support/env.ts'],
    env: {
      TEST_SUITE: 'integration',
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    reporters: ['default'],
  },
});
