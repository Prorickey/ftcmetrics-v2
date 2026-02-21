import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@ftcmetrics/db': path.resolve(__dirname, '../db/src'),
      '@ftcmetrics/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
