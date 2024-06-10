module.exports = {
  automock: false,
  clearMocks: true,
  verbose: true,
  testEnvironment: 'node',
  testMatch: ['**/integration/?(*.)+(spec|test).[t]s?(x)'],
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  setupFiles: ['<rootDir>/jest.env.js'],
  testSequencer: '<rootDir>/jest.sequence.js'
}
