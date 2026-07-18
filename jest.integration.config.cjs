module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__integration__/**/*.test.ts'],
  testTimeout: 30000,
};
