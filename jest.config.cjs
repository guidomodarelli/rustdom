/** @file Runs browser integrations in Jest's real custom environment. */
module.exports = {
  projects: [
    { displayName: 'jest-dom', testEnvironment: '<rootDir>/src/environments/jest.cjs',
      modulePathIgnorePatterns: ['<rootDir>/.cache/', '<rootDir>/.tools/'],
      testMatch: ['<rootDir>/tests/integration/**/*.jest.cjs'] },
  ],
};
