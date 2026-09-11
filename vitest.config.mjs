/** @file Exercises the native-backed browser environment in Vitest worker processes. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: './src/environments/vitest.mjs',
    include: ['tests/integration/**/*.vitest.mjs'],
    maxWorkers: 2,
  },
});
