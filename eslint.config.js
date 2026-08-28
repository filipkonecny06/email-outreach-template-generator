/** Shared lint policy for Node.js modules and browser-delivered scripts. */
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/public/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  }
];
