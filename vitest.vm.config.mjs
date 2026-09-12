/** @file Runs the same real browser integrations in both supported Vitest VM pools. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['vmForks', 'vmThreads'].map((pool) => ({
      test: { name: pool, pool, maxWorkers: 1, environment: './src/environments/vitest.mjs',
        include: ['tests/integration/**/*.vm.mjs', 'tests/integration/platform.vitest.mjs'] },
    })),
  },
});
