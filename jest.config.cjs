/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/dist/test'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
};
