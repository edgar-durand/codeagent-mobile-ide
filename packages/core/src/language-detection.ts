/**
 * File-extension → Monaco language id mapping, shared by web + native
 * FileViewer hosts. Lives in @codeam/ide-core so consumers can also use
 * it directly for tabs, breadcrumbs, etc. — they don't need to bundle
 * either UI package just to know "what language is this file?".
 *
 * Monaco's catalogue is large (300+ tokenisers); this table covers the
 * ~40 languages we've observed in real users' repos. Anything not in the
 * table falls through to `plaintext` which renders without highlighting
 * but doesn't error — adding a language is just one row.
 */

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  java: 'java',
  swift: 'swift',
  m: 'objective-c',
  mm: 'objective-c',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  scala: 'scala',
  dart: 'dart',
  lua: 'lua',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  md: 'markdown',
  html: 'html',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gradle: 'kotlin',
};

/**
 * Returns the Monaco language id for a given file path. The match is
 * case-insensitive and considers two special-case basenames
 * (Dockerfile, Makefile) that have no extension. Unknown files fall
 * through to `plaintext`.
 */
export function detectLanguage(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('dockerfile')) return 'dockerfile';
  if (lower.endsWith('makefile')) return 'makefile';
  const ext = lower.split('.').pop() ?? '';
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}
