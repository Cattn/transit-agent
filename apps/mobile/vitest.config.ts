import { defineConfig } from 'vitest/config';

// Unit tests cover only the pure helpers in src/platform (no react-native / expo imports),
// so they run in plain Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
