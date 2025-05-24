module.exports = {
  displayName: 'frontend',
  testEnvironment: 'jsdom',
  rootDir: './frontend/wine-recommender',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        '@babel/preset-env',
        '@babel/preset-typescript',
        '@babel/preset-react'
      ],
    }],
  },
  testMatch: [
    '<rootDir>/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    '/node_modules/(?!@swc/helpers|@babel/runtime)/'
  ],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
};
