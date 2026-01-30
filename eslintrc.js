module.exports = {
  extends: 'eslint:recommended',
  env: {
    node: true,
    es2021: true
  },
  rules: {
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-console': 'warn'
  }
};
