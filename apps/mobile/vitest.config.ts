import { defineConfig } from 'vitest/config';

// Unit tests run in plain Node; tests that touch react-native / expo modules mock them
// (see server-url.test.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
