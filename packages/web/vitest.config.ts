import { defineConfig } from 'vitest/config';

// Web components are plain DOM, so unlike the native package there are no host
// primitives to stub — they render for real through react-dom into jsdom. The
// setup file only flips React's act environment flag and stubs the Monaco
// loader, which would otherwise try to pull the editor off a CDN.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
