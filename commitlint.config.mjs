export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'web',
        'native',
        'examples',
        'workflow',
        'meta',
        'deps',
        'release',
        'changelog',
        'docs',
      ],
    ],
    'subject-max-length': [2, 'always', 100],
  },
};
