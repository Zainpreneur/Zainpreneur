import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.test.ts'],
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://zainpreneur:zainpreneur_dev@localhost:5432/zainpreneur_test',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long',
      JWT_EXPIRES_IN: '7d',
      CORS_ORIGIN: 'http://localhost:5900',
      LOG_LEVEL: 'warn',
      PORT: '3000',
      HOST: '0.0.0.0',
    },
  },
})
