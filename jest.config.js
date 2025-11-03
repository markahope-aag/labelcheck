const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

/**
 * Jest Configuration - Unit Tests Only
 *
 * This config is for testing business logic, utilities, and helper functions.
 * For API route and E2E testing, use Playwright (see /e2e directory).
 *
 * Run with: npm run test:unit
 */
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Test environment
  testEnvironment: 'jest-environment-jsdom',

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Coverage configuration - Focus on business logic only
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    '!lib/supabase.ts', // Database client, tested via integration tests
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],

  // Coverage thresholds (aspirational - start low, increase over time)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Test match patterns - Unit tests only (lib/ directory)
  testMatch: [
    '**/__tests__/lib/**/*.[jt]s?(x)',
    '**/__tests__/app/api/analyze/select-category/**/*.[jt]s?(x)', // Keep this one passing API test
    '!**/__tests__/utils/**', // Exclude utility files from test discovery
  ],

  // Transform files
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
    '^.+\\.mjs$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'ecmascript',
          },
          target: 'es2020',
          module: {
            type: 'commonjs',
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node', 'mjs'],

  // Ignore patterns
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],

  // Transform ignore patterns - allow transforming ESM modules from various packages
  // This tells Jest to NOT ignore these packages, so they get transformed
  // The pattern matches: transform everything EXCEPT node_modules, BUT DO transform these specific packages
  transformIgnorePatterns: ['node_modules/(?!(@clerk|@supabase|@babel|@jest|uuid|nanoid)/)'],

  // Verbose output
  verbose: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
