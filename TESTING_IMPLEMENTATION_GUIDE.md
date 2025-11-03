# Testing Implementation Guide - Jest & React Testing Library

**Purpose:** Production-ready testing setup for LabelCheck Next.js application  
**Framework:** Jest + React Testing Library  
**Target Coverage:** 60-70% (critical paths)

---

## Table of Contents

1. [Why Testing Matters for Production](#why-testing-matters)
2. [Setup & Installation](#setup-installation)
3. [Configuration](#configuration)
4. [Test Organization](#test-organization)
5. [Testing Patterns](#testing-patterns)
6. [Examples for Your Codebase](#examples)
7. [CI/CD Integration](#cicd-integration)
8. [Best Practices](#best-practices)

---

## Why Testing Matters for Production

### Benefits:
- ✅ **Catch bugs before users do** - Regression testing prevents production failures
- ✅ **Confidence in refactoring** - Change code knowing tests will catch breakage
- ✅ **Documentation** - Tests show how code is supposed to work
- ✅ **Faster debugging** - Failing tests pinpoint exact issues
- ✅ **Better design** - Writing tests forces better code structure

### Real-World Example:
```
Without Tests:
1. Developer refactors GRAS compliance check
2. Breaks edge case handling
3. Goes to production
4. Customer reports incorrect GRAS results
5. Hotfix needed (expensive!)

With Tests:
1. Developer refactors GRAS compliance check
2. Tests fail (catch the bug)
3. Fix before deployment
4. All tests pass
5. Confident deployment ✅
```

---

## Setup & Installation

### Step 1: Install Dependencies

```bash
npm install --save-dev \
  jest \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @types/jest
```

### Step 2: Install Next.js Testing Utilities

```bash
npm install --save-dev \
  @testing-library/next \
  next-test-utils
```

**Note:** For Next.js 14, you can also use `@testing-library/next` for routing helpers.

---

## Configuration

### `jest.config.js`

Create this file in your project root:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Test environment
  testEnvironment: 'jest-environment-jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Module name mapping (for @ imports)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],
  
  // Coverage thresholds (target: 60-70%)
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    // Higher thresholds for critical files
    './lib/gras-helpers.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
    },
    './lib/ndi-helpers.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
```

### `jest.setup.js`

Create this file for global test setup:

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

// Mock Clerk authentication
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'test-user-id',
    isLoaded: true,
    isSignedIn: true,
  }),
  useUser: () => ({
    user: {
      id: 'test-user-id',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isLoaded: true,
  }),
  auth: jest.fn(() => ({
    userId: 'test-user-id',
  })),
}))

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
  },
}))

// Suppress console warnings in tests (optional)
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}
```

### Update `package.json`

Add test scripts:

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

## Test Organization

### Directory Structure

```
labelcheck/
├── __tests__/                    # Global test utilities
│   ├── setup.ts
│   └── mocks/
│       ├── supabase.ts
│       ├── clerk.ts
│       └── openai.ts
│
├── app/                          # Next.js pages
│   └── analyze/
│       ├── page.tsx
│       └── page.test.tsx         # Co-located tests
│
├── lib/                          # Helper libraries
│   ├── gras-helpers.ts
│   ├── gras-helpers.test.ts      # Co-located tests
│   └── analysis/
│       ├── orchestrator.ts
│       └── orchestrator.test.ts
│
├── components/                   # React components
│   ├── AnalysisChat.tsx
│   └── AnalysisChat.test.tsx
│
├── app/api/                      # API routes
│   └── analyze/
│       ├── route.ts
│       └── route.test.ts
│
└── jest.config.js
└── jest.setup.js
```

**Best Practice:** Co-locate tests with source files for easier maintenance.

---

## Testing Patterns

### 1. Unit Tests (Helper Functions)

**Purpose:** Test pure functions in isolation

**Example:** `lib/gras-helpers.test.ts`

```typescript
import { checkGRASCompliance } from './gras-helpers';
import { getCachedGRASIngredients } from './ingredient-cache';

// Mock the cache
jest.mock('./ingredient-cache');

describe('checkGRASCompliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock cached ingredients
    (getCachedGRASIngredients as jest.Mock).mockResolvedValue([
      {
        ingredient_name: 'caffeine',
        synonyms: ['coffee extract', 'coffee bean extract'],
        is_active: true,
      },
      {
        ingredient_name: 'sugar',
        synonyms: ['sucrose', 'cane sugar'],
        is_active: true,
      },
    ]);
  });

  it('should identify GRAS ingredients correctly', async () => {
    const ingredients = ['caffeine', 'sugar'];
    const result = await checkGRASCompliance(ingredients);

    expect(result.totalIngredients).toBe(2);
    expect(result.grasCompliant).toBe(2);
    expect(result.nonGRASIngredients).toHaveLength(0);
    expect(result.overallCompliant).toBe(true);
  });

  it('should identify non-GRAS ingredients', async () => {
    const ingredients = ['unknown-chem-xyz123'];
    const result = await checkGRASCompliance(ingredients);

    expect(result.nonGRASIngredients).toContain('unknown-chem-xyz123');
    expect(result.overallCompliant).toBe(false);
  });

  it('should match by synonym', async () => {
    const ingredients = ['coffee extract']; // Synonym of 'caffeine'
    const result = await checkGRASCompliance(ingredients);

    expect(result.grasCompliant).toBe(1);
    expect(result.detailedResults[0].matchType).toBe('synonym');
  });

  it('should handle empty ingredient list', async () => {
    const result = await checkGRASCompliance([]);

    expect(result.totalIngredients).toBe(0);
    expect(result.grasCompliant).toBe(0);
  });
});
```

### 2. Component Tests (React)

**Purpose:** Test UI components and user interactions

**Example:** `components/AnalysisChat.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisChat } from './AnalysisChat';

// Mock the API call
global.fetch = jest.fn();

describe('AnalysisChat', () => {
  const mockAnalysisId = 'test-analysis-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders chat interface', () => {
    render(<AnalysisChat analysisId={mockAnalysisId} userId={mockUserId} />);

    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('sends message when user submits', async () => {
    const user = userEvent.setup();
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: 'This product is compliant with FDA regulations.',
        timestamp: new Date().toISOString(),
      }),
    });

    render(<AnalysisChat analysisId={mockAnalysisId} userId={mockUserId} />);

    const input = screen.getByPlaceholderText(/ask a question/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Is this compliant?');
    await user.click(sendButton);

    // Wait for API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analyze/chat'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Is this compliant?'),
        })
      );
    });

    // Verify message appears in chat
    expect(await screen.findByText(/this product is compliant/i)).toBeInTheDocument();
  });

  it('displays error when API call fails', async () => {
    const user = userEvent.setup();
    
    // Mock failed API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Failed to process message',
        code: 'INTERNAL_ERROR',
      }),
    });

    render(<AnalysisChat analysisId={mockAnalysisId} userId={mockUserId} />);

    const input = screen.getByPlaceholderText(/ask a question/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Verify error message appears
    expect(await screen.findByText(/failed to process/i)).toBeInTheDocument();
  });

  it('disables send button while loading', async () => {
    const user = userEvent.setup();
    
    // Mock slow API response
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ response: 'Done' }),
              }),
            100
          )
        )
    );

    render(<AnalysisChat analysisId={mockAnalysisId} userId={mockUserId} />);

    const input = screen.getByPlaceholderText(/ask a question/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    await user.type(input, 'Test');
    await user.click(sendButton);

    // Button should be disabled while loading
    expect(sendButton).toBeDisabled();

    // Wait for response
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
  });
});
```

### 3. API Route Tests (Integration)

**Purpose:** Test API endpoints end-to-end

**Example:** `app/api/analyze/route.test.ts`

```typescript
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createMocks } from 'node-mocks-http';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase');
jest.mock('@/lib/analysis/orchestrator');

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { runAnalysis } from '@/lib/analysis/orchestrator';

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const formData = new FormData();
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('AUTH_ERROR');
  });

  it('should validate file size', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    
    // Mock user exists
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-internal-id', email: 'test@example.com' },
            error: null,
          }),
        }),
      }),
    });

    const formData = new FormData();
    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });
    formData.append('image', largeFile);

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('too large');
  });

  it('should successfully analyze image', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    
    // Mock user and usage check
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-internal-id', email: 'test@example.com' },
            error: null,
          }),
        }),
      }),
    });

    // Mock usage check
    (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { analyses_this_month: 5, monthly_limit: 100 },
            error: null,
          }),
        }),
      }),
    });

    // Mock analysis result
    (runAnalysis as jest.Mock).mockResolvedValue({
      id: 'analysis-id',
      compliance_status: 'compliant',
      analysis_result: {
        product_category: 'CONVENTIONAL_FOOD',
        overall_assessment: {
          primary_compliance_status: 'compliant',
        },
      },
    });

    const formData = new FormData();
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('analysis-id');
    expect(runAnalysis).toHaveBeenCalled();
  });
});
```

### 4. Custom Hook Tests

**Example:** `hooks/useAnalysis.test.ts` (if you extract hooks)

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAnalysis } from './useAnalysis';

describe('useAnalysis', () => {
  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useAnalysis());

    expect(result.current.result).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.error).toBe('');
  });

  it('should update state when analysis starts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-id' }),
    });

    const { result } = renderHook(() => useAnalysis());

    await act(async () => {
      await result.current.analyzeLabel(new File(['test'], 'test.jpg'));
    });

    await waitFor(() => {
      expect(result.current.isAnalyzing).toBe(false);
    });

    expect(result.current.result).not.toBeNull();
  });
});
```

---

## Examples for Your Codebase

### Priority 1: Critical Helper Functions

**File:** `lib/gras-helpers.test.ts`

```typescript
import { checkGRASCompliance } from './gras-helpers';
import { getCachedGRASIngredients } from './ingredient-cache';

jest.mock('./ingredient-cache');

describe('GRAS Compliance Check', () => {
  it('matches ingredients by exact name', async () => {
    (getCachedGRASIngredients as jest.Mock).mockResolvedValue([
      { ingredient_name: 'caffeine', synonyms: [], is_active: true },
    ]);

    const result = await checkGRASCompliance(['caffeine']);

    expect(result.grasCompliant).toBe(1);
    expect(result.nonGRASIngredients).toHaveLength(0);
  });

  it('matches ingredients by synonym', async () => {
    (getCachedGRASIngredients as jest.Mock).mockResolvedValue([
      { ingredient_name: 'caffeine', synonyms: ['coffee extract'], is_active: true },
    ]);

    const result = await checkGRASCompliance(['coffee extract']);

    expect(result.detailedResults[0].matchType).toBe('synonym');
  });
});
```

### Priority 2: API Routes

**File:** `app/api/analyze/route.test.ts`

```typescript
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { handleApiError } from '@/lib/error-handler';

jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/error-handler');

describe('/api/analyze', () => {
  it('requires authentication', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
```

### Priority 3: Components

**File:** `components/ErrorAlert.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorAlert } from './ErrorAlert';

describe('ErrorAlert', () => {
  it('displays error message', () => {
    render(<ErrorAlert message="Something went wrong" />);
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error code when provided', () => {
    render(<ErrorAlert message="Error" code="RATE_LIMIT" />);
    
    expect(screen.getByText(/rate_limit/i)).toBeInTheDocument();
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

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
          node-version: '20'
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
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

      - name: Fail if coverage below threshold
        run: |
          COVERAGE=$(npm run test:coverage -- --coverageReporters=text-summary | grep -oP 'All files\s+\|\s+\d+\.\d+' | grep -oP '\d+\.\d+')
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "Coverage is below 60%: $COVERAGE%"
            exit 1
          fi
```

---

## Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
describe('functionName', () => {
  it('should do something specific', () => {
    // Arrange - Set up test data
    const input = 'test';
    
    // Act - Execute the function
    const result = functionName(input);
    
    // Assert - Verify the result
    expect(result).toBe('expected');
  });
});
```

### 2. Test Naming

**Good:**
- `should return error when user is not authenticated`
- `should match ingredient by exact name`
- `should display error message when API fails`

**Bad:**
- `test 1`
- `works`
- `check function`

### 3. Mock External Dependencies

```typescript
// Mock API calls
global.fetch = jest.fn();

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));
```

### 4. Test User Interactions, Not Implementation

**Good:**
```typescript
// Test what user sees/does
await user.click(screen.getByRole('button', { name: /submit/i }));
expect(screen.getByText('Success')).toBeInTheDocument();
```

**Bad:**
```typescript
// Testing internal implementation
expect(component.state.isSubmitting).toBe(true);
```

### 5. Use `screen` from Testing Library

```typescript
import { screen } from '@testing-library/react';

// Good - uses screen
expect(screen.getByText('Hello')).toBeInTheDocument();

// Bad - queries container directly
expect(container.querySelector('button')).toBeInTheDocument();
```

### 6. Async Testing

```typescript
// Wait for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});

// Or use findBy (auto-waits)
expect(await screen.findByText('Loaded')).toBeInTheDocument();
```

### 7. Test Coverage Targets

- **Critical paths:** 80%+ (GRAS, NDI, analysis)
- **API routes:** 70%+
- **Components:** 60%+
- **Utilities:** 80%+
- **Overall:** 60-70%

---

## Running Tests

### Development

```bash
# Watch mode (runs tests on file changes)
npm run test:watch

# Run all tests once
npm test

# Run tests for specific file
npm test gras-helpers.test.ts
```

### CI/CD

```bash
# Run tests in CI mode (no watch, with coverage)
npm run test:ci
```

### Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View in browser
open coverage/lcov-report/index.html
```

---

## Next Steps for Your Codebase

### Phase 1: Setup (1 hour)
1. Install dependencies
2. Create `jest.config.js` and `jest.setup.js`
3. Add test scripts to `package.json`
4. Verify setup with a simple test

### Phase 2: Critical Tests (2-3 hours)
1. `lib/gras-helpers.test.ts` - GRAS matching logic
2. `lib/ndi-helpers.test.ts` - NDI compliance
3. `lib/analysis/post-processor.test.ts` - Post-processing

### Phase 3: API Tests (2 hours)
1. `app/api/analyze/route.test.ts`
2. `app/api/analyze/chat/route.test.ts`
3. `app/api/share/route.test.ts`

### Phase 4: Component Tests (2 hours)
1. `components/ErrorAlert.test.tsx`
2. `components/AnalysisChat.test.tsx`
3. `components/TextChecker.test.tsx`

### Phase 5: CI/CD (1 hour)
1. Add GitHub Actions workflow
2. Configure coverage reporting
3. Set up branch protection

---

## Summary

Testing in production is essential for:
- ✅ **Reliability** - Catch bugs before users
- ✅ **Confidence** - Refactor safely
- ✅ **Documentation** - Tests show how code works
- ✅ **Speed** - Faster debugging with failing tests

**Start Small:** Write tests for your most critical functions first (GRAS, NDI compliance), then expand to API routes and components.

**Target:** 60-70% coverage on critical paths within 2-3 weeks.

---

**Questions?** This guide covers the essentials. For Next.js-specific testing patterns, see:
- [Next.js Testing Docs](https://nextjs.org/docs/testing)
- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Docs](https://jestjs.io/docs/getting-started)

