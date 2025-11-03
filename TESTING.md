# Testing Infrastructure Documentation

**Status:** ✅ Complete
**Test Coverage:** 54 unit tests across core validation and compliance modules
**Last Updated:** Session 15 - 2025-11-02

## Overview

LabelCheck now has a comprehensive testing infrastructure using Jest, React Testing Library, and @swc/jest for fast TypeScript compilation. This document explains the testing setup, patterns, and best practices.

## Test Suite Summary

### Total Coverage
- **54 passing tests** across 4 test suites
- **Test Execution Time:** ~1.5 seconds
- **Coverage Thresholds:** 30% (aspirational baseline, will increase over time)

### Test Breakdown by Module

#### 1. Validation Tests (16 tests)
**File:** `__tests__/lib/validation.test.ts`

Tests Zod validation schemas for type-safe API request validation:
- ✅ `analyzeRequestSchema` - File upload validation (4 tests)
- ✅ `chatRequestSchema` - Chat request validation (4 tests)
- ✅ `textCheckerTextSchema` - Text/PDF checker validation (3 tests)
- ✅ `shareRequestSchema` - Share link validation (2 tests)
- ✅ `formatValidationErrors` - Error formatting (2 tests)
- ✅ `createValidationErrorResponse` - Error response structure (1 test)

**Key Test Cases:**
- Valid requests with all fields
- Valid requests with only required fields
- Invalid UUID format rejection
- String length limit enforcement (e.g., 200 chars for label names, 1000 for chat messages)
- File size and type validation
- Nested field error handling

#### 2. GRAS Compliance Tests (9 tests)
**File:** `__tests__/lib/gras-helpers.test.ts`

Tests GRAS (Generally Recognized as Safe) ingredient validation for conventional foods:
- ✅ `checkGRASCompliance` - Ingredient compliance checking (6 tests)
- ✅ `buildGRASContext` - AI context message generation (3 tests)

**Key Test Cases:**
- Empty ingredient list handling
- Exact ingredient name matching
- Synonym-based matching
- Non-GRAS ingredient detection with critical warnings
- Mixed compliant/non-compliant ingredient lists
- Ingredient name normalization (removing parentheses, percentages, stereoisomer prefixes)
- Context message generation for compliant vs non-compliant reports

#### 3. NDI/ODI Compliance Tests (10 tests)
**File:** `__tests__/lib/ndi-helpers.test.ts`

Tests NDI (New Dietary Ingredient) and ODI (Old Dietary Ingredient) validation for supplements:
- ✅ `checkNDICompliance` - DSHEA compliance checking (7 tests)
- ✅ `formatNDIInfo` - NDI notification formatting (3 tests)

**Key Test Cases:**
- Empty ingredient list handling
- NDI notification detection (exact and partial matches)
- Pre-1994 grandfathered ingredient recognition
- Unknown ingredient flagging (requires NDI notification)
- Mixed ingredient types (NDI, ODI, unknown)
- Case-insensitive name normalization
- Complete vs incomplete NDI record formatting
- Date formatting for submission/response dates

#### 4. Allergen Detection Tests (19 tests)
**File:** `__tests__/lib/allergen-helpers.test.ts`

Tests FALCPA/FASTER Act allergen detection (9 major allergens):
- ✅ `checkIngredientForAllergens` - Single ingredient checking (8 tests)
- ✅ `checkIngredientsForAllergens` - Batch ingredient checking (6 tests)
- ✅ `formatAllergenResults` - Result formatting (5 tests)

**Key Test Cases:**
- Exact allergen name matching (e.g., "Milk")
- Derivative detection (e.g., "Whey" → Milk)
- Case-insensitive matching (e.g., "CASEIN" → Milk)
- Ingredient name normalization (removing parentheses, percentages, prefixes)
- Fuzzy matching for compound ingredients (e.g., "Shrimp Extract" → Shellfish)
- False positive prevention (e.g., "Royal Jelly" is NOT an allergen)
- Multiple allergen detection in ingredient lists
- High vs medium confidence scoring
- Unique allergen counting
- Empty ingredient list handling
- Result formatting with checkmarks (high confidence) and question marks (medium confidence)

## Technology Stack

### Core Testing Libraries
- **Jest 30.2.0** - Test framework
- **@testing-library/react 16.3.0** - React component testing utilities
- **@testing-library/jest-dom 6.9.1** - Custom Jest matchers for DOM
- **@testing-library/user-event 14.6.1** - User interaction simulation
- **@swc/jest 0.2.39** - Fast TypeScript/JavaScript compiler (replaces ts-jest)
- **jest-environment-jsdom 30.2.0** - DOM environment for React tests

### Configuration Files
- **jest.config.js** - Jest configuration with Next.js integration
- **jest.setup.js** - Global test setup (environment variables, console mocks)
- **__tests__/utils/mocks.ts** - Reusable mock factories

## Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (with coverage, max 2 workers)
npm run test:ci
```

## Mock Utilities

### Factory Functions (`__tests__/utils/mocks.ts`)

The mock utilities provide factory functions for creating test data with sensible defaults:

```typescript
// GRAS ingredient mocks
createMockGRASIngredient(overrides?: Partial<GRASIngredient>)

// NDI ingredient mocks
createMockNDIIngredient(overrides?: Partial<NDIIngredient>)

// ODI ingredient mocks
createMockODIIngredient(overrides?: Partial<OldDietaryIngredient>)

// Allergen mocks
createMockAllergen(overrides?: Partial<MajorAllergen>)

// Full analysis result mocks
createMockAnalysisResult(overrides?: Partial<AnalysisResult>)

// Service mocks
createMockSupabaseClient() // Supabase client with helper methods
createMockClerkAuth(userId?: string) // Clerk authentication
createMockOpenAIClient() // OpenAI client with chat completion mock
```

### Pre-built Test Data Collections

```typescript
testGRASIngredients // 3 common GRAS ingredients (Caffeine, Citric Acid, Ascorbic Acid)
testNDIIngredients // 2 NDI notification examples (Astaxanthin, Beta-glucan)
testODIIngredients // 2 ODI examples (Ginseng, Echinacea)
testAllergens // 3 major allergens (Milk, Eggs, Soy)
```

## Testing Patterns

### 1. Arrange-Act-Assert Pattern

```typescript
it('should validate valid analyze request with all fields', () => {
  // ARRANGE: Set up test data
  const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
  Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

  const validData = {
    image: mockFile,
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    labelName: 'Test Label',
  };

  // ACT: Execute the function being tested
  const result = analyzeRequestSchema.safeParse(validData);

  // ASSERT: Verify the results
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.image).toBe(mockFile);
    expect(result.data.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000');
  }
});
```

### 2. Mock Setup with `beforeEach`

```typescript
describe('GRAS Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Reset all mocks before each test
  });

  it('should ...', async () => {
    // Test implementation
  });
});
```

### 3. Inline Mock Data

For simple mocks, define data inline in jest.mock() factory:

```typescript
jest.mock('@/lib/ingredient-cache', () => ({
  getCachedNDIIngredients: jest.fn().mockResolvedValue([
    {
      id: '123e4567-e89b-12d3-a456-426614174001',
      notification_number: 1,
      ingredient_name: 'Astaxanthin',
      firm: 'Test Firm',
      submission_date: '2024-01-01',
      fda_response_date: '2024-02-01',
    },
  ]),
}));
```

### 4. Type-Safe Assertions

Use TypeScript type guards for safer assertions:

```typescript
const result = analyzeRequestSchema.safeParse(validData);
expect(result.success).toBe(true);

if (result.success) {
  // TypeScript now knows result.data is valid
  expect(result.data.image).toBe(mockFile);
}
```

### 5. Testing Error Conditions

```typescript
it('should reject analyze request with invalid UUID sessionId', () => {
  const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

  const invalidData = {
    image: mockFile,
    sessionId: 'not-a-uuid', // Invalid UUID format
  };

  const result = analyzeRequestSchema.safeParse(invalidData);
  expect(result.success).toBe(false);

  if (!result.success) {
    expect(result.error.errors[0].message).toContain('session ID');
  }
});
```

## Coverage Configuration

**Current Thresholds (Aspirational Baseline):**
- Branches: 30%
- Functions: 30%
- Lines: 30%
- Statements: 30%

**Coverage Includes:**
- `lib/**/*.{js,jsx,ts,tsx}`
- `app/**/*.{js,jsx,ts,tsx}`
- `components/**/*.{js,jsx,ts,tsx}`

**Coverage Excludes:**
- `**/*.d.ts` (TypeScript definition files)
- `**/node_modules/**`
- `**/.next/**`
- `**/coverage/**`
- `**/dist/**`

**Viewing Coverage:**
```bash
npm run test:coverage
# Opens coverage report in coverage/lcov-report/index.html
```

## Best Practices

### 1. Test Naming
Use descriptive test names that explain the expected behavior:

```typescript
// ✅ Good
it('should reject chat request with question over 1000 characters', () => {})

// ❌ Bad
it('test question validation', () => {})
```

### 2. Test Independence
Each test should be independent and not rely on other tests:

```typescript
// ✅ Good - each test creates its own data
it('test 1', () => {
  const data = createMockData();
  // test with data
});

it('test 2', () => {
  const data = createMockData();
  // test with data
});

// ❌ Bad - tests share mutable state
let sharedData;
it('test 1', () => {
  sharedData = createMockData();
  // modify sharedData
});

it('test 2', () => {
  // relies on sharedData from test 1
});
```

### 3. Mock at the Right Level
Mock external dependencies, not internal implementation details:

```typescript
// ✅ Good - mock external service
jest.mock('@/lib/supabase');

// ❌ Bad - mock internal function (brittle)
jest.mock('@/lib/gras-helpers', () => ({
  normalizeIngredientName: jest.fn(), // Too granular
}));
```

### 4. Use Factory Functions
Leverage factory functions for cleaner test setup:

```typescript
// ✅ Good - use factory with overrides
const ingredient = createMockGRASIngredient({
  ingredient_name: 'Caffeine',
  synonyms: ['1,3,7-trimethylxanthine'],
});

// ❌ Bad - manually create full object every time
const ingredient = {
  id: '123...',
  ingredient_name: 'Caffeine',
  cas_number: null,
  gras_notice_number: 'GRN 000923',
  // ... 10 more fields
};
```

### 5. Test Both Success and Failure Cases
Always test both happy path and error conditions:

```typescript
describe('chatRequestSchema', () => {
  it('should validate valid chat request', () => {
    // Test success case
  });

  it('should reject chat request with missing question', () => {
    // Test failure case
  });
});
```

## Environment Variables

Test environment variables are configured in `jest.setup.js`:

```javascript
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-publishable-key';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
```

## Console Output Management

Console errors and warnings are suppressed during tests to reduce noise:

```javascript
// In jest.setup.js
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
```

## Continuous Integration

For CI environments, use the `test:ci` script:

```bash
npm run test:ci
```

This script:
- Runs in CI mode (non-interactive)
- Generates coverage reports
- Limits worker threads to 2 (for resource-constrained CI environments)
- Exits with error code if tests fail

## Future Improvements

### Short-term (Next Session)
1. **Integration Tests** - Test full API routes (`/api/analyze`, `/api/chat`, etc.)
2. **Component Tests** - Test React components with user interactions
3. **E2E Tests** - Add Playwright or Cypress for end-to-end testing
4. **Increase Coverage** - Gradually raise threshold from 30% → 50% → 70%

### Medium-term
1. **Snapshot Testing** - For UI component regression testing
2. **Performance Testing** - Benchmark critical operations
3. **Visual Regression Testing** - Catch UI changes automatically
4. **Test Data Builders** - More sophisticated test data generation

### Long-term
1. **Contract Testing** - Ensure API contracts are maintained
2. **Mutation Testing** - Verify test quality with mutation testing tools
3. **Property-Based Testing** - Use tools like fast-check for generative testing

## Troubleshooting

### Common Issues

#### 1. "Cannot find module '@swc/core'"
**Solution:** Install missing peer dependency
```bash
npm install --save-dev @swc/core
```

#### 2. "FormData iteration TypeScript error"
**Solution:** Use `Array.from()` instead of direct iteration
```typescript
// ❌ Causes TS2802 error
for (const [key, value] of formData.entries()) {}

// ✅ Works correctly
Array.from(formData.entries()).forEach(([key, value]) => {})
```

#### 3. "ReferenceError: Cannot access before initialization"
**Solution:** Don't use imported functions in jest.mock() factory. Define inline instead.
```typescript
// ❌ Causes initialization error
jest.mock('@/lib/cache', () => ({
  getCached: jest.fn().mockResolvedValue([
    createMockData(), // Imported function not available yet
  ]),
}));

// ✅ Works correctly
jest.mock('@/lib/cache', () => ({
  getCached: jest.fn().mockResolvedValue([
    { id: '123', name: 'Test' }, // Inline data
  ]),
}));
```

#### 4. "Test suite must contain at least one test"
**Solution:** Add test exclusion pattern to `jest.config.js`
```javascript
testMatch: [
  '**/__tests__/**/*.[jt]s?(x)',
  '**/?(*.)+(spec|test).[jt]s?(x)',
  '!**/__tests__/utils/**', // Exclude utility files
],
```

## Related Documentation

- [Input Validation Documentation](./INPUT_VALIDATION_COMPLETE.md)
- [GRAS Database Documentation](./GRAS_DATABASE.md)
- [Allergen Database Documentation](./ALLERGEN_DATABASE.md)
- [Session Notes](./SESSION_NOTES.md)
- [Technical Debt Tracking](./TECHNICAL_DEBT.md)

## Maintenance

**Ownership:** Engineering Team
**Review Frequency:** Monthly
**Last Review:** Session 15 - 2025-11-02
**Next Review:** Session 16+
