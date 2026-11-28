import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/+(*.)+(spec).ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  moduleNameMapper: {
    '^maplibre-gl$': '<rootDir>/src/__mocks__/maplibre-gl.ts',
  },
};

export default config;
