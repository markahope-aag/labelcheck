# Testing in Production Apps: Jest + Testing Library Guide

**Target:** LabelCheck Production Codebase  
**Framework:** Next.js 14 + TypeScript  
**Testing Stack:** Jest + React Testing Library

---

## Overview: Why Testing in Production?

### Benefits
1. **Catch Bugs Before Deployment** - 80% of bugs caught in automated tests
2. **Enable Safe Refactoring** - Change code with confidence
3. **Document Behavior** - Tests serve as living documentation
4. **Faster Development** - Automated tests faster than manual testing
5. **CI/CD Integration** - Block bad deployments automatically

### Real-World Impact

**Without Tests:**
- Manual testing: 2-3 hours per feature
- Bugs reach production: 10-15% of changes
- Rollback frequency: Monthly
- Developer confidence: Low

**With Tests:**
- Automated testing: 5-10 minutes
- Bugs reach production: <2% of changes
- Rollback frequency: Rare
- Developer confidence: High

---

## Testing Stack Components

### 1. Jest (Test Runner)
- Runs tests, collects coverage, parallel execution
- **Install:** `npm install --save-dev jest @types/jest jest-environment-jsdom`

### 2. React Testing Library (Component Testing)
- Tests components from user's perspective
- **Install:** `npm install --save-dev @testing-library/react @testing-library/jest-dom`

### 3. Testing Library User Event (Interactions)
- Simulates user interactions (clicks, typing)
- **Install:** `npm install --save-dev @testing-library/user-event`

### 4. MSW (Mock Service Worker) - Optional but Recommended
- Mock API calls for integration tests
- **Install:** `npm install --save-dev msw`

---

## Test Types in Production Apps

### 1. Unit Tests (70% of tests)
**Purpose:** Test individual functions in isolation

**Examples:**
- Helper functions (`lib/gras-helpers.ts`)
- Utility functions (`lib/image-processing.ts`)
- Business logic (`lib/analysis/post-processor.ts`)

**When to Write:**
- For pure functions (no side effects)
- Complex logic that needs validation
- Critical business rules

### 2. Integration Tests (20% of tests)
**Purpose:** Test how multiple parts work together

**Examples:**
- API routes end-to-end
- Database operations
- External service integrations

**When to Write:**
- For API endpoints
- Database interactions
- Service integrations (OpenAI, Stripe)

### 3. Component Tests (10% of tests)
**Purpose:** Test React components from user perspective

**Examples:**
- Form submissions
- User interactions
- Conditional rendering

**When to Write:**
- Critical user flows
- Complex components
- User-facing interactions

---

## Production Testing Setup

### Step 1: Install Dependencies

```bash
npm install --save-dev \
  jest \
  @types/jest \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @testing-library/react-hooks \
  msw \
  whatwg-fetch
```

### Step 2: Create Jest Configuration

**`jest.config.js`:**
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
```

### Step 3: Create Jest Setup File

**`jest.setup.js`:**
```javascript
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'test-user-id',
    isLoaded: true,
  }),
  auth: jest.fn(() => ({
    userId: 'test-user-id',
  })),
  clerkClient: {
    users: {
      createUser: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          maybeSingle: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(),
      })),
      delete: jest.fn()(() => ({
        eq: jest.fn(),
      })),
    })),
  },
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          maybeSingle: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}))
```

### Step 4: Update package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## Real Production Examples

### Example 1: Unit Test - Helper Function

**File:** `lib/__tests__/gras-helpers.test.ts`

```typescript
import { checkGRASCompliance } from '@/lib/gras-helpers'
import { getCachedGRASIngredients } from '@/lib/ingredient-cache'

// Mock the cache module
jest.mock('@/lib/ingredient-cache')

describe('checkGRASCompliance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should identify GRAS-compliant ingredients', async () => {
    // Mock cache response
    const mockIngredients = [
      { ingredient_name: 'salt', is_active: true },
      { ingredient_name: 'sugar', is_active: true },
      { ingredient_name: 'unknown_chemical', is_active: true },
    ]

    ;(getCachedGRASIngredients as jest.Mock).mockResolvedValue(mockIngredients)

    const ingredients = ['salt', 'sugar', 'unknown_chemical']

    const result = await checkGRASCompliance(ingredients)

    expect(result.totalIngredients).toBe(3)
    expect(result.grasCompliant).toBe(2)
    expect(result.nonGRASIngredients).toEqual(['unknown_chemical'])
    expect(result.overallCompliant).toBe(false)
  })

  it('should handle empty ingredient list', async () => {
    ;(getCachedGRASIngredients as jest.Mock).mockResolvedValue([])

    const result = await checkGRASCompliance([])

    expect(result.totalIngredients).toBe(0)
    expect(result.grasCompliant).toBe(0)
    expect(result.nonGRASIngredients).toEqual([])
    expect(result.overallCompliant).toBe(true)
  })

  it('should match ingredients with synonyms', async () => {
    const mockIngredients = [
      {
        ingredient_name: 'sodium chloride',
        synonyms: ['salt', 'table salt'],
        is_active: true,
      },
    ]

    ;(getCachedGRASIngredients as jest.Mock).mockResolvedValue(mockIngredients)

    const result = await checkGRASCompliance(['salt'])

    expect(result.grasCompliant).toBe(1)
    expect(result.detailedResults[0].matchType).toBe('synonym')
  })
})
```

**Why This Matters:**
- Catches bugs in ingredient matching logic
- Ensures synonyms work correctly
- Validates edge cases (empty lists)

---

### Example 2: Integration Test - API Route

**File:** `app/api/__tests__/analyze/route.test.ts`

```typescript
import { POST } from '@/app/api/analyze/route'
import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { openai } from '@/app/api/analyze/route'

// Mock dependencies
jest.mock('@clerk/nextjs/server')
jest.mock('@/lib/supabase')
jest.mock('openai')

describe('/api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 for unauthenticated requests', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ userId: null })

    const formData = new FormData()
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('AUTH_ERROR')
  })

  it('should validate file size limit', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' })

    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    })

    const formData = new FormData()
    formData.append('image', largeFile)

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(data.error).toContain('too large')
  })

  it('should check usage limits before analysis', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' })

    // Mock user lookup
    ;(supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'user-123', monthly_limit: 10 },
            error: null,
          }),
        }),
      }),
    })

    // Mock usage check - limit exceeded
    ;(supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { analyses_this_month: 10, monthly_limit: 10 },
            error: null,
          }),
        }),
      }),
    })

    const formData = new FormData()
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.code).toBe('RATE_LIMIT')
  })

  it('should process valid analysis request', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' })

    // Mock all dependencies
    // ... setup mocks ...

    const formData = new FormData()
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }))

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    // Verify analysis result structure
  })
})
```

**Why This Matters:**
- Validates authentication
- Tests business rules (rate limits, file validation)
- Ensures proper error handling
- Catches API contract violations

---

### Example 3: Component Test - User Interaction

**File:** `components/__tests__/TextChecker.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextChecker } from '@/components/TextChecker'
import * as nextNavigation from 'next/navigation'

// Mock router
jest.mock('next/navigation')

describe('TextChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should submit text analysis on button click', async () => {
    const user = userEvent.setup()

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'analysis-123',
        result: { product_name: 'Test Product' },
      }),
    })

    render(<TextChecker />)

    // Find textarea and button
    const textarea = screen.getByPlaceholderText(/paste label text/i)
    const button = screen.getByRole('button', { name: /analyze/i })

    // Type text
    await user.type(textarea, 'Ingredients: salt, sugar, water')

    // Submit
    await user.click(button)

    // Wait for API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analyze/text'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })
  })

  it('should display error message on API failure', async () => {
    const user = userEvent.setup()

    // Mock fetch to fail
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Analysis failed',
        code: 'ANALYSIS_ERROR',
      }),
    })

    render(<TextChecker />)

    const textarea = screen.getByPlaceholderText(/paste label text/i)
    const button = screen.getByRole('button', { name: /analyze/i })

    await user.type(textarea, 'test')
    await user.click(button)

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/analysis failed/i)).toBeInTheDocument()
    })
  })

  it('should disable button while analyzing', async () => {
    const user = userEvent.setup()

    // Mock slow API call
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ id: '123' }),
              }),
            100
          )
        )
    )

    render(<TextChecker />)

    const textarea = screen.getByPlaceholderText(/paste label text/i)
    const button = screen.getByRole('button', { name: /analyze/i })

    await user.type(textarea, 'test')
    await user.click(button)

    // Button should be disabled
    expect(button).toBeDisabled()

    // Wait for completion
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })
})
```

**Why This Matters:**
- Validates user flows
- Tests error states
- Ensures UI feedback (loading states)
- Catches UX bugs

---

## Production Testing Best Practices

### 1. Test Critical Paths First

**Priority Order:**
1. ✅ Payment flows (Stripe integration)
2. ✅ Authentication (Clerk webhooks)
3. ✅ Core analysis logic (GRAS/NDI checks)
4. ✅ API routes (rate limiting, validation)
5. ✅ User-facing components (forms, uploads)

### 2. Follow Testing Library Principles

**✅ DO:**
```typescript
// Test from user's perspective
const button = screen.getByRole('button', { name: /submit/i })
await user.click(button)

// Test accessibility
expect(screen.getByLabelText(/email/i)).toBeInTheDocument()

// Test error messages
expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
```

**❌ DON'T:**
```typescript
// Don't test implementation details
expect(component.state.isLoading).toBe(true) // ❌

// Don't test internal methods
expect(component.handleSubmit).toHaveBeenCalled() // ❌
```

### 3. Mock External Services

**Always mock:**
- Database calls (Supabase)
- External APIs (OpenAI, Stripe, Clerk)
- File system operations
- Network requests

**Example:**
```typescript
// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
        }),
      },
    },
  })),
}))
```

### 4. Test Error Cases

**Production apps need:**
- Error handling tests
- Edge case validation
- Boundary condition tests

**Example:**
```typescript
it('should handle OpenAI API timeout', async () => {
  // Mock timeout
  openai.chat.completions.create.mockRejectedValue(
    new Error('Request timeout')
  )

  // Should retry or fail gracefully
  const result = await analyzeLabel(imageFile)
  expect(result.error).toBeDefined()
})
```

### 5. Use Test Data Factories

**Create reusable test data:**
```typescript
// __tests__/factories/analysisFactory.ts
export const createMockAnalysis = (overrides = {}) => ({
  id: 'analysis-123',
  user_id: 'user-123',
  product_name: 'Test Product',
  compliance_status: 'compliant',
  ...overrides,
})

// In tests:
const analysis = createMockAnalysis({ compliance_status: 'non_compliant' })
```

---

## CI/CD Integration

### GitHub Actions Workflow

**.github/workflows/test.yml:**
```yaml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: false
```

### Branch Protection Rules

**GitHub Settings:**
1. Require status checks to pass before merging
2. Require branches to be up to date
3. Required checks: `test`, `typecheck`, `lint`

---

## Coverage Goals for Production

### Minimum Coverage Targets

| Type | Coverage Goal | Reason |
|------|---------------|--------|
| **Critical Paths** | 90%+ | Payment, auth, core analysis |
| **API Routes** | 80%+ | All endpoints, error cases |
| **Helper Functions** | 85%+ | Business logic |
| **Components** | 70%+ | User-facing flows |
| **Overall** | 60%+ | Good balance |

### What to Test

**✅ Test:**
- Business logic
- Error handling
- Edge cases
- User flows
- API contracts

**❌ Don't Test:**
- Third-party library internals
- Implementation details
- Trivial code (getters/setters)
- Generated code

---

## Running Tests in Production Workflow

### Local Development

```bash
# Watch mode (auto-rerun on changes)
npm run test:watch

# Single run
npm test

# With coverage
npm run test:coverage
```

### Pre-Commit Hook

**`.husky/pre-commit`:**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests on changed files
npm run test:ci -- --onlyChanged
```

### CI/CD Pipeline

1. **Push to branch** → GitHub Actions runs tests
2. **Tests pass** → Allow merge
3. **Tests fail** → Block merge, show errors
4. **Coverage drops** → Warn (don't block)

---

## Real Production Metrics

### Before Testing (Typical)
- **Bugs in Production:** 10-15% of changes
- **Time to Fix:** 2-4 hours per bug
- **Rollbacks:** Monthly
- **Developer Confidence:** Low

### After Testing (Your Goal)
- **Bugs in Production:** <2% of changes
- **Time to Fix:** 30 minutes (caught early)
- **Rollbacks:** Rare
- **Developer Confidence:** High

### ROI Calculation

**Investment:**
- Setup: 1 hour
- Writing tests: 1-2 hours per feature
- Maintenance: 10% of dev time

**Return:**
- 80% fewer production bugs
- 70% faster debugging
- 50% faster feature development (confidence)
- 90% fewer rollbacks

**Break-even:** ~2-3 months

---

## Next Steps for LabelCheck

### Phase 1: Setup (1 hour)
1. Install dependencies
2. Configure Jest
3. Create test utilities
4. Set up CI/CD

### Phase 2: Critical Tests (4 hours)
1. GRAS compliance logic
2. NDI compliance logic
3. API route: `/api/analyze`
4. API route: `/api/analyze/chat`

### Phase 3: Coverage (4 hours)
1. Remaining API routes
2. Helper functions
3. Key components

### Phase 4: CI/CD (1 hour)
1. GitHub Actions workflow
2. Coverage reporting
3. Branch protection

**Total:** ~10 hours for solid test foundation

---

## Summary

**Jest + Testing Library in production means:**
- ✅ Automated quality gates
- ✅ Confidence in deployments
- ✅ Faster development cycles
- ✅ Fewer production bugs
- ✅ Better code documentation

**Key Principle:** Test behavior, not implementation. Write tests that give you confidence to deploy.

---

**Questions?** See examples in `__tests__/` directory once implemented.

