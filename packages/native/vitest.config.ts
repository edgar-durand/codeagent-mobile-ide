import { defineConfig } from 'vitest/config';

// Component specs render the real components through react-dom into jsdom;
// the RN host primitives are stubbed in `src/test/setup.tsx` (react-native's
// own sources are Flow and can't be imported outside the Jest preset).
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
