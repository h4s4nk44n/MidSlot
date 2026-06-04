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

  // MEDI-103: coverage scoped to our own source. The generated Prisma client,
  // tests, type declarations and the listen-only bootstrap are excluded so the
  // numbers reflect application code, not framework boilerplate.
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/generated/**",
    "!src/__tests__/**",
    "!src/types/**",
    "!src/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text-summary", "lcov", "json-summary"],
  // Modest gate: set just below the current numbers so the build fails on a
  // meaningful regression without demanding a big-bang test backfill. Raise as
  // coverage improves. Documented in the README "Continuous Integration".
  coverageThreshold: {
    global: {
      statements: 40,
      lines: 40,
      functions: 30,
      branches: 15,
    },
  },
};

export default config;
