import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Force the DTS bundler to inline @codeam/ide-core types into
  // dist/index.d.ts. Without this, rollup-plugin-dts (tsup's DTS
  // backend) doesn't reliably resolve the freshly-built sibling
  // workspace's d.ts during CI publish — DEFAULT_EDITOR_SETTINGS
  // and friends are present in the symlinked dist but never read.
  // Inlining bloats the .d.ts slightly but consumers get the same
  // types either way, and runtime imports still resolve through
  // the external dep at JS load time.
  dts: { resolve: ['@codeam/ide-core'] },
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['react', 'react-dom', '@monaco-editor/react', '@codeam/ide-core'],
  splitting: false,
  treeshake: true,
});
