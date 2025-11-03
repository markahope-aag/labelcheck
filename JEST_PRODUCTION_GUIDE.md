# Jest & Testing Library - Production Usage Guide

**Status:** You already have Jest configured! ✅  
**Current Setup:** Jest 30.2.0 + React Testing Library 16.3.0  
**Existing Tests:** 4 test files in `__tests__/lib/`

This guide shows you **how to effectively use** Jest and React Testing Library in production.

---

## Quick Reference

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (runs on file changes) - MOST USEFUL during development
npm run test:watch

# Generate coverage report
npm run test:coverage

# CI mode (no watch, parallel workers)
npm run test:ci
```

---

## Production Testing Patterns

### 1. **Unit Tests** - Test Pure Functions in Isolation

**Purpose:** Test helper functions, utilities, and business logic

**Example from Your Codebase:** `lib/gras-helpers.ts`

```typescript
// __tests__/lib/gras-helpers.test.ts
import { checkGRASCompliance } from '@/lib/gras-helpers';
import { getCachedGRASIngredients } from '@/lib/ingredient-cache';

// Mock the cache (important: don't hit real database)
jest.mock('@/lib/ingredient-cache');

describe('checkGRASCompliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock data for each test
    (getCachedGRASIngredients as jest.Mock).mockResolvedValue([
      {
        ingredient_name: 'caffeine',
        synonyms: ['coffee extract'],
        is_active: true,
        gras_notice_number: 'GRN-123',
      },
    ]);
  });

  it('should match ingredients by exact name', async () => {
    const result = await checkGRASCompliance(['caffeine']);
    
    expect(result.grasCompliant).toBe(1);
    expect(result.nonGRASIngredients).toHaveLength(0);
    expect(result.overallCompliant).toBe(true);
  });

  it('should match by synonym', async () => {
    // Test synonym matching logic
    const result = await checkGRASCompliance(['coffee extract']);
    
    expect(result.detailedResults[0].matchType).toBe('synonym');
    expect(result.grasCompliant).toBe(1);
  });

  it('should identify non-GRAS ingredients', async () => {
    const result = await checkGRASCompliance(['unknown-chemical-xyz']);
    
    expect(result.nonGRASIngredients).toContain('unknown-chemical-xyz');
    expect(result.overallCompliant).toBe(false);
  });
});
```

**Key Principles:**
- ✅ Mock external dependencies (database, API calls)
- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Clean up mocks in `beforeEach`

---

### 2. **Component Tests** - Test User Interactions

**Purpose:** Test React components and user interactions

**Example:** Testing `components/ErrorAlert.tsx`

```typescript
// components/ErrorAlert.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorAlert } from './ErrorAlert';

describe('ErrorAlert', () => {
  it('displays error message', () => {
    render(<ErrorAlert message="Something went wrong" />);
    
    // Test what user sees
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error code when provided', () => {
    render(
      <ErrorAlert 
        message="Rate limit exceeded" 
        code="RATE_LIMIT" 
      />
    );
    
    // Check both message and code are visible
    expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    expect(screen.getByText(/RATE_LIMIT/i)).toBeInTheDocument();
  });

  it('applies correct variant styling', () => {
    const { container } = render(
      <ErrorAlert message="Error" variant="destructive" />
    );
    
    // Check className includes variant
    expect(container.firstChild).toHaveClass('destructive');
  });
});
```

**Testing User Interactions:**

```typescript
// components/AnalysisChat.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisChat } from './AnalysisChat';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnalysisChat - User Interactions', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('sends message when user clicks send button', async () => {
    const user = userEvent.setup();
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: 'This product is compliant.',
        timestamp: new Date().toISOString(),
      }),
    });

    render(<AnalysisChat analysisId="test-id" userId="user-123" />);

    // Find input and button
    const input = screen.getByPlaceholderText(/ask a question/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Simulate user typing
    await user.type(input, 'Is this compliant?');
    
    // Simulate user clicking
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

    // Verify response appears in UI
    expect(await screen.findByText(/this product is compliant/i)).toBeInTheDocument();
  });

  it('disables send button while loading', async () => {
    const user = userEvent.setup();
    
    // Mock slow response
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ response: 'Done' }),
        }), 100)
      )
    );

    render(<AnalysisChat analysisId="test-id" userId="user-123" />);

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

**Key Principles:**
- ✅ Test what users see and do (not implementation)
- ✅ Use `userEvent` for realistic interactions
- ✅ Use `waitFor` for async operations
- ✅ Use `screen` queries (not container)

---

### 3. **API Route Tests** - Test Endpoints

**Purpose:** Test API routes (Next.js App Router)

**Example:** Testing `/api/analyze` endpoint

```typescript
// app/api/analyze/route.test.ts
import { POST } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase');
jest.mock('@/lib/analysis/orchestrator');

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication', async () => {
    // Mock unauthenticated user
    (auth as jest.Mock).mockResolvedValue({ userId: null });

    const formData = new FormData();
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    // Should return 401
    expect(response.status).toBe(401);
    expect(data.code).toBe('AUTH_ERROR');
  });

  it('validates file size', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: 'user-123' });

    // Create large file (>10MB)
    const largeFile = new File(
      ['x'.repeat(11 * 1024 * 1024)], 
      'large.jpg', 
      { type: 'image/jpeg' }
    );

    const formData = new FormData();
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

  it('successfully processes valid image', async () => {
    (auth as jest.Mock).mockResolvedValue({ userId: 'user-123' });

    // Mock user exists
    const { supabaseAdmin } = require('@/lib/supabase');
    (supabaseAdmin.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'user-id', email: 'test@example.com' },
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
    const { runAnalysis } = require('@/lib/analysis/orchestrator');
    (runAnalysis as jest.Mock).mockResolvedValue({
      id: 'analysis-id',
      compliance_status: 'compliant',
    });

    const formData = new FormData();
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new NextRequest('http://localhost:3000/api/analyze', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(runAnalysis).toHaveBeenCalled();
  });
});
```

---

### 4. **Mocking Best Practices**

#### Mock External APIs

```typescript
// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => 
            Promise.resolve({ data: mockData, error: null })
          ),
        })),
      })),
    })),
  },
}));

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{}' } }],
        }),
      },
    },
  })),
}));

// Mock Clerk
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() => Promise.resolve({ userId: 'test-user-id' })),
}));
```

#### Mock Next.js Router

```typescript
// In jest.setup.js or test file
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));
```

---

## Production Workflow

### During Development

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Run tests in watch mode
npm run test:watch
```

**Benefits:**
- Tests run automatically when you change files
- Fast feedback loop
- Catch bugs before committing

### Before Committing

```bash
# Run all tests once
npm test

# Check coverage
npm run test:coverage

# Verify types
npm run typecheck
```

### In CI/CD

Your `test:ci` script runs:
- Tests in parallel (`--maxWorkers=2`)
- Coverage report
- No watch mode (`--ci`)

---

## Coverage Targets

**Your Current Threshold:** 30% (good starting point)

**Recommended Progression:**
1. **Week 1:** 30% (where you are now)
2. **Week 2-3:** 50% (add API route tests)
3. **Month 2:** 60% (add component tests)
4. **Month 3:** 70% (critical paths)

**Critical Files Should Target 80%+:**
- `lib/gras-helpers.ts`
- `lib/ndi-helpers.ts`
- `lib/analysis/post-processor.ts`
- `lib/error-handler.ts`

---

## Common Testing Patterns

### Testing Async Functions

```typescript
it('handles async operations', async () => {
  const promise = someAsyncFunction();
  
  await expect(promise).resolves.toEqual(expectedValue);
  // OR
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### Testing Error Handling

```typescript
it('handles errors gracefully', async () => {
  // Mock error
  (global.fetch as jest.Mock).mockRejectedValueOnce(
    new Error('Network error')
  );

  render(<Component />);
  await userEvent.click(screen.getByRole('button'));

  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### Testing Form Submissions

```typescript
it('submits form with correct data', async () => {
  const user = userEvent.setup();
  
  render(<Form />);

  await user.type(screen.getByLabelText(/name/i), 'John');
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('John'),
      })
    );
  });
});
```

---

## What to Test in Production

### ✅ High Priority (Test These First)

1. **Critical Business Logic**
   - GRAS compliance matching ✅ (you have this)
   - NDI compliance checking ✅ (you have this)
   - Allergen detection ✅ (you have this)
   - Error handling logic

2. **API Routes**
   - Authentication checks
   - Input validation
   - Error responses

3. **Components with User Input**
   - Forms
   - File uploads
   - Chat interactions

### 🟡 Medium Priority

4. **Helper Functions**
   - Data transformations
   - Utility functions

5. **Complex Components**
   - Multi-step workflows
   - Conditional rendering

### 🟢 Low Priority

6. **Simple Presentational Components**
   - Static displays
   - Basic styling

---

## Debugging Tests

### View Test Output

```bash
# Verbose output (shows all tests)
npm test -- --verbose

# Show coverage for specific file
npm test -- --coverage --collectCoverageFrom='lib/gras-helpers.ts'
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "name": "Jest Debug",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache", "--watchAll=false"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

---

## Integration with Pre-Commit

Add to `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run tests on changed files
npm run test -- --findRelatedTests --passWithNoTests
```

This runs tests for files you changed before allowing commit.

---

## Summary

**Your Setup:** ✅ Complete  
**Current Tests:** ✅ 4 files in `__tests__/lib/`  
**Next Steps:**

1. **Expand helper tests** - Add more edge cases
2. **Add API route tests** - Start with `/api/analyze`
3. **Add component tests** - Start with `ErrorAlert`, `AnalysisChat`
4. **Increase coverage** - Target 50-60% in next month

**Key Takeaway:** In production, tests act as:
- ✅ **Safety net** - Catch bugs before users
- ✅ **Documentation** - Show how code works
- ✅ **Confidence** - Refactor without fear

Run `npm run test:watch` during development for immediate feedback! 🚀

