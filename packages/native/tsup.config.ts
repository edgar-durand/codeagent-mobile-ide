import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: [
    'react',
    'react-native',
    'react-native-safe-area-context',
    'react-native-webview',
    '@expo/vector-icons',
    '@codeam/ide-core',
  ],
  splitting: false,
  treeshake: true,
});
