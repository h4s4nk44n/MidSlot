import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  // setupFiles run BEFORE the test framework is installed and BEFORE any
  // test file imports — this is what we need so that `import "../index"`
  // sees JWT_SECRET et al. setupFilesAfterEach would be too late.
  setupFiles: ["<rootDir>/jest.setup.ts"],
};

export default config;
