import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
      prisma: path.resolve(__dirname, 'prisma'),
      generated: path.resolve(__dirname, 'generated'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.unit.spec.ts', 'src/**/__tests__/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/**'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/main.ts',
        '**/*.module.ts',
        '**/*.controller.ts',
        'src/middleware.ts',
        '**/*.dto.ts',
        '**/*.types.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
});
