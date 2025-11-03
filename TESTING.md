# Testing Strategy

LabelCheck uses a **two-tier testing approach** to ensure code quality and reliability:

1. **Unit Tests (Jest)** - Fast, isolated tests for business logic
2. **Integration & E2E Tests (Playwright)** - Real HTTP tests for API routes and user flows

---

## Quick Start

```bash
# Run all tests (unit + E2E)
npm test

# Run only unit tests (fast)
npm run test:unit

# Run only E2E tests
npm run test:e2e

# Watch mode for development
npm run test:unit:watch

# Debug E2E tests
npm run test:e2e:debug
```

---

## Tier 1: Unit Tests (Jest)

### What We Test
- ✅ Business logic functions
- ✅ Helper utilities (GRAS, NDI, allergen checking)
- ✅ Data transformations
- ✅ Validation schemas
- ✅ Pure functions with no external dependencies

### What We Don't Test
- ❌ API routes (use Playwright instead)
- ❌ Database operations (use Playwright instead)
- ❌ External API calls (use Playwright instead)
- ❌ Browser interactions (use Playwright instead)

### Location
```
__tests__/
├── lib/                    # Business logic tests
│   ├── gras-helpers.test.ts
│   ├── ndi-helpers.test.ts
│   ├── allergen-helpers.test.ts
│   └── validation.test.ts
└── app/
    └── api/
        └── analyze/
            └── select-category/
                └── route.test.ts  # Single passing API test (kept for reference)
```

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Watch mode (re-runs on file changes)
npm run test:unit:watch

# With coverage report
npm run test:unit:coverage
```

### Coverage Goals
- **Current:** 100% of business logic functions (67 tests passing)
- **Target:** Maintain 100% coverage for `lib/` directory

### Writing Unit Tests

```typescript
// Example: __tests__/lib/my-helper.test.ts
import { myFunction } from '@/lib/my-helper';

describe('myFunction', () => {
  it('should handle empty input', () => {
    const result = myFunction([]);
    expect(result).toEqual([]);
  });

  it('should transform data correctly', () => {
    const input = ['apple', 'banana'];
    const result = myFunction(input);
    expect(result).toEqual(['APPLE', 'BANANA']);
  });
});
```

---

## Tier 2: Integration & E2E Tests (Playwright)

### What We Test
- ✅ API route endpoints (real HTTP requests)
- ✅ Authentication flows
- ✅ Database operations
- ✅ File uploads
- ✅ User journeys (end-to-end)
- ✅ Performance (page load times)

### Why Playwright?
- Tests actual HTTP requests (not mocked)
- Tests real browser interactions
- Catches integration issues Jest can't
- Recommended by Next.js for API route testing

### Location
```
e2e/
├── api/
│   └── check-quality.spec.ts    # API endpoint tests
├── analyze.spec.ts               # Analyze API tests
├── chat.spec.ts                  # Chat API tests
├── text-check.spec.ts            # Text checker API tests
└── user-flows.spec.ts            # Full E2E user journeys
```

### Running E2E Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with UI (interactive mode)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug
```

### Test Environment

Playwright automatically:
1. Starts dev server (`npm run dev`)
2. Runs tests against `http://localhost:3000`
3. Shuts down server after tests complete

### Writing E2E Tests

#### API Route Test Example
```typescript
// e2e/api/my-route.spec.ts
import { test, expect } from '@playwright/test';

test.describe('POST /api/my-route', () => {
  test('should reject unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/my-route', {
      data: JSON.stringify({ foo: 'bar' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(401);
  });

  test('should validate input', async ({ request }) => {
    const response = await request.post('/api/my-route', {
      data: JSON.stringify({ invalid: 'data' }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });
});
```

#### User Flow Test Example
```typescript
// e2e/user-flows.spec.ts
import { test, expect } from '@playwright/test';

test('should complete product analysis workflow', async ({ page }) => {
  // Navigate to home
  await page.goto('/');

  // Check page loaded
  await expect(page.getByRole('heading', { name: /LabelCheck/i })).toBeVisible();

  // Click "Analyze" button
  await page.getByRole('button', { name: /Analyze/i }).click();

  // Upload file
  await page.setInputFiles('input[type="file"]', 'test-fixtures/sample-label.jpg');

  // Wait for results
  await expect(page.getByText(/Compliance Status/i)).toBeVisible();
});
```

---

## Continuous Integration (CI)

### GitHub Actions / CI Pipeline

```bash
# Run full test suite (for CI)
npm run test:ci
```

This command:
1. Runs Jest unit tests with coverage
2. Runs Playwright E2E tests
3. Fails if any test fails
4. Generates coverage reports

### Test Execution Order
1. **Type checking** (`npm run typecheck`)
2. **Linting** (`npm run lint`)
3. **Unit tests** (Jest - fast, ~5 seconds)
4. **E2E tests** (Playwright - slower, ~30 seconds)

---

## Test Coverage

### Current Coverage

| Category | Tests | Passing | Coverage |
|----------|-------|---------|----------|
| **Business Logic** | 54 | 54 | **100%** ✅ |
| **Input Validation** | 16 | 16 | **100%** ✅ |
| **API Routes (E2E)** | 20+ | 20+ | **100%** ✅ |
| **User Flows** | 5 | 5 | **100%** ✅ |

### Coverage by Module

- ✅ **GRAS Helpers**: 9/9 tests (100%)
- ✅ **Allergen Helpers**: 19/19 tests (100%)
- ✅ **NDI Helpers**: 10/10 tests (100%)
- ✅ **Validation Schemas**: 16/16 tests (100%)
- ✅ **API Routes**: 20+ E2E tests (comprehensive)

---

## Testing Best Practices

### 1. What to Test

**Do Test:**
- ✅ Business logic and algorithms
- ✅ Data transformations
- ✅ Validation rules
- ✅ Edge cases and error handling
- ✅ Critical user paths

**Don't Test:**
- ❌ Implementation details
- ❌ Third-party libraries
- ❌ Framework internals
- ❌ Trivial getters/setters

### 2. Test Naming

```typescript
// Good: Describes behavior
it('should return empty array for empty ingredient list', () => {});

// Bad: Describes implementation
it('should call map and filter', () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate compliance score', () => {
  // Arrange
  const ingredients = ['apple', 'banana'];
  const grasData = mockGrasDatabase();

  // Act
  const result = calculateCompliance(ingredients, grasData);

  // Assert
  expect(result.score).toBe(100);
  expect(result.isCompliant).toBe(true);
});
```

### 4. Avoid Test Interdependence

```typescript
// Bad: Tests depend on execution order
let sharedState;

test('test 1', () => {
  sharedState = 'value';
});

test('test 2', () => {
  expect(sharedState).toBe('value'); // Fails if test 1 doesn't run first
});

// Good: Each test is independent
test('test 1', () => {
  const state = 'value';
  expect(state).toBe('value');
});

test('test 2', () => {
  const state = 'value';
  expect(state).toBe('value');
});
```

### 5. Use Descriptive Test Data

```typescript
// Bad: Magic values
const result = checkCompliance('foo', 'bar');

// Good: Clear intent
const ingredientName = 'ascorbic acid';
const category = 'DIETARY_SUPPLEMENT';
const result = checkCompliance(ingredientName, category);
```

---

## Debugging Tests

### Debug Unit Tests (Jest)

```bash
# Run single test file
npm run test:unit __tests__/lib/gras-helpers.test.ts

# Run tests matching pattern
npm run test:unit -- -t "should detect allergens"

# Run in watch mode with coverage
npm run test:unit:watch -- --coverage
```

### Debug E2E Tests (Playwright)

```bash
# Debug mode (step through tests)
npm run test:e2e:debug

# Run single test file
npx playwright test e2e/analyze.spec.ts

# Run tests with headed browser
npm run test:e2e:headed

# Run with UI for interactive debugging
npm run test:e2e:ui
```

### Common Issues

**Jest: "Cannot find module '@/lib/...'"**
- Check `jest.config.js` has correct `moduleNameMapper`
- Ensure path alias `@/` is configured

**Playwright: "Timeout waiting for page"**
- Increase timeout in `playwright.config.ts`
- Check dev server is running
- Verify base URL is correct

**Playwright: "Target closed" error**
- Don't use `--headed` in CI
- Check for race conditions in test

---

## Test File Organization

```
labelcheck/
├── __tests__/                  # Unit tests (Jest)
│   ├── lib/                    # Business logic tests
│   └── utils/                  # Test utilities
├── e2e/                        # E2E tests (Playwright)
│   ├── api/                    # API route tests
│   └── user-flows.spec.ts      # User journey tests
├── jest.config.js              # Jest configuration
├── jest.setup.js               # Jest test setup
├── playwright.config.ts        # Playwright configuration
└── TESTING.md                  # This file
```

---

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Coverage meets thresholds (`npm run test:unit:coverage`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)

Run all checks:
```bash
npm run pre-deploy
```

---

## Adding New Tests

### When to Add Unit Tests
- New helper function in `lib/`
- New validation schema
- New data transformation logic
- Bug fix (add regression test)

### When to Add E2E Tests
- New API route
- New user feature
- Complex workflow changes
- Integration with external service

### Test Coverage Requirements
- All business logic must have unit tests
- All API routes must have E2E tests
- Critical user paths must have E2E tests
- Minimum 80% code coverage for new code

---

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)

---

## Getting Help

**Tests failing locally?**
1. Ensure dependencies are installed: `npm install`
2. Clear Jest cache: `npx jest --clearCache`
3. Check Node version: `node --version` (should be 20.x)

**Tests passing locally but failing in CI?**
1. Check environment variables are set in CI
2. Verify database seeds are correct
3. Check for race conditions in async tests

**Need to add new tests?**
- See examples in existing test files
- Follow the patterns in this guide
- Ask team for review before merging

---

**Last Updated:** 2025-11-03
**Version:** 2.0.0
