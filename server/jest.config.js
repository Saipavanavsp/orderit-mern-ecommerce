// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  testTimeout: 30000,
  collectCoverageFrom: ['services/**/*.js', 'controllers/**/*.js', 'middleware/**/*.js', 'utils/**/*.js'],
};
