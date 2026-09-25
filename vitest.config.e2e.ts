import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['test/support/global-setup.e2e.ts'],
    setupFiles: ['test/support/env.ts'],
    env: {
      TEST_SUITE: 'e2e',
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    reporters: ['default'],
  },
});
