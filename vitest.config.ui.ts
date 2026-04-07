import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./client/src/__tests__/setup.ts'],
    include: ['./client/src/__tests__/**/*.test.{ts,tsx}'],
    css: false,
  },
});
