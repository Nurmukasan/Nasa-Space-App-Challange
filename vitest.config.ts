import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'shared/test/**/*.test.ts',
      'server/test/**/*.test.ts',
      'client/src/**/*.test.ts',
      'tools/**/*.test.ts',
    ],
    testTimeout: 15000,
  },
});
