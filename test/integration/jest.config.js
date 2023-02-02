module.exports = {
  automock: false,
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['**/integration/?(*.)+(spec|test).[t]s?(x)'],
  transform: { '^.+\\.tsx?$': 'ts-jest' }
}
