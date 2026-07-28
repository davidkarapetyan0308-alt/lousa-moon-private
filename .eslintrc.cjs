module.exports = {
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'android/', '.expo/', 'dist/', 'coverage/'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['scripts/**/*.js'],
      env: { node: true, es2022: true },
    },
  ],
};
