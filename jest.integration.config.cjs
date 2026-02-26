/** @type {import('jest').Config} */
const baseConfig = require('./jest.config.cjs');

module.exports = {
  ...baseConfig,
  roots: ['<rootDir>/test-integration'],
};
