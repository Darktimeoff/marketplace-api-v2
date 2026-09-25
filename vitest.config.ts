import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Vitest picks a different default reporter depending on the environment
    // it detects (TTY vs CI vs piped output) — pinning it keeps output
    // identical no matter where this runs.
    reporters: ['default'],
  },
});
