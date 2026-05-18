import type { MonacoTheme } from '../types/theme';

/**
 * GitHub Dark theme port. Palette tracks GitHub's "dark default"
 * variant — the one used on github.com and in the official VS Code
 * "GitHub Theme" extension (Primer/colors-dark@v0.5.x). Subset of
 * rules + colors that Monaco actually consumes; the rest of GitHub's
 * UI-only color ids are dropped.
 */
export const githubDarkTheme: MonacoTheme = {
  name: 'github-dark',
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
    { token: 'string', foreground: 'a5d6ff' },
    { token: 'string.escape', foreground: '79c0ff' },
    { token: 'constant', foreground: '79c0ff' },
    { token: 'constant.numeric', foreground: '79c0ff' },
    { token: 'constant.language', foreground: '79c0ff' },
    { token: 'variable', foreground: 'ffa657' },
    { token: 'variable.parameter', foreground: 'ffa657' },
    { token: 'variable.other.constant', foreground: '79c0ff' },
    { token: 'keyword', foreground: 'ff7b72' },
    { token: 'keyword.control', foreground: 'ff7b72' },
    { token: 'keyword.operator', foreground: 'ff7b72' },
    { token: 'storage', foreground: 'ff7b72' },
    { token: 'storage.type', foreground: 'ff7b72' },
    { token: 'entity.name.function', foreground: 'd2a8ff' },
    { token: 'entity.name.class', foreground: 'ffa657' },
    { token: 'entity.name.type', foreground: 'ffa657' },
    { token: 'entity.name.tag', foreground: '7ee787' },
    { token: 'support.function', foreground: 'd2a8ff' },
    { token: 'support.class', foreground: 'ffa657' },
    { token: 'support.type', foreground: 'ffa657' },
    { token: 'punctuation.definition.tag', foreground: '7ee787' },
    { token: 'meta.tag', foreground: 'c9d1d9' },
    { token: 'invalid', foreground: 'ffdcd7', background: '8e1519' },
    { token: 'markup.heading', foreground: '79c0ff', fontStyle: 'bold' },
    { token: 'markup.bold', foreground: 'ffa657', fontStyle: 'bold' },
    { token: 'markup.italic', foreground: 'a5d6ff', fontStyle: 'italic' },
    { token: 'markup.inserted', foreground: 'aff5b4', background: '033a16' },
    { token: 'markup.deleted', foreground: 'ffdcd7', background: '67060c' },
  ],
  colors: {
    'editor.background': '#0d1117',
    'editor.foreground': '#c9d1d9',
    'editor.lineHighlightBackground': '#161b22',
    'editor.selectionBackground': '#264f78',
    'editor.inactiveSelectionBackground': '#3a3d41',
    'editorCursor.foreground': '#c9d1d9',
    'editorLineNumber.foreground': '#484f58',
    'editorLineNumber.activeForeground': '#c9d1d9',
    'editorIndentGuide.background': '#21262d',
    'editorIndentGuide.activeBackground': '#30363d',
    'editor.findMatchBackground': '#bb800966',
    'editor.findMatchHighlightBackground': '#bb800944',
    'editorBracketMatch.background': '#3fb95040',
    'editorBracketMatch.border': '#3fb95080',
    'editorGutter.modifiedBackground': '#bb8009',
    'editorGutter.addedBackground': '#3fb950',
    'editorGutter.deletedBackground': '#f85149',
    'diffEditor.insertedTextBackground': '#3fb95022',
    'diffEditor.removedTextBackground': '#f8514922',
  },
};
