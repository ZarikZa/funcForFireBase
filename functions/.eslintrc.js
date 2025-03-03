/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020, // или 2021, в зависимости от версии Node.js
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'quotes': ['error', 'double', { 'allowTemplateLiterals': true }],
  },
  overrides: [
    {
      files: ['**/*.spec.*'],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
