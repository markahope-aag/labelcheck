# Error Handling Migration Guide

**Estimated Time:** 3-4 hours
**Current Status:** 0% → Target: 100%
**Priority:** HIGH - Improves debugging, monitoring, and user experience

---

## Overview

This migration introduces centralized error handling across the LabelCheck application, replacing ad-hoc error responses with a structured, type-safe error system.

**Benefits:**
- ✅ Consistent error responses across all API routes
- ✅ Better debugging with error codes and metadata
- ✅ Improved monitoring (track errors by code)
- ✅ Better UX with specific error messages
- ✅ Type-safe error handling (builds on 100% type safety)

---

## Migration Structure

### Phase 1: Foundation (1 hour)
Create error class hierarchy and centralized handler

### Phase 2: API Routes (2 hours)
Migrate all API routes to use new error system
- Batch 1: Core Analysis Routes (4 files)
- Batch 2: Supporting Routes (7 files)
- Batch 3: Admin Routes (11 files)
- Batch 4: Webhook Routes (2 files)

### Phase 3: Frontend Integration (1 hour)
Add error display components and update API calls

---

## Phase 1: Foundation Files

### File 1: Create `lib/errors.ts`

**Purpose:** Custom error class hierarchy for different error scenarios

**Full file content:**

```typescript
/**
 * Base application error class
 * All custom errors extend this class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }
}

/**
 * Validation errors (400)
 * Use when request data is invalid
 */
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
  }
}

/**
 * Authentication errors (401)
 * Use when user is not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
  }
}

/**
 * Authorization errors (403)
 * Use when user lacks permissions
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Not found errors (404)
 * Use when resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
  }
}

/**
 * Rate limit errors (429)
 * Use when user exceeds usage limits
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    metadata?: { limit?: number; current?: number; resetDate?: string }
  ) {
    super(message, 'RATE_LIMIT', 429, metadata);
  }
}

/**
 * External service errors (502)
 * Use when external API calls fail (OpenAI, Stripe, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error | string) {
    super(
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      {
        service,
        originalError: typeof originalError === 'string'
          ? originalError
          : originalError?.message
      }
    );
  }
}

/**
 * Database errors (500)
 * Use when Supabase queries fail
 */
export class DatabaseError extends AppError {
  constructor(operation: string, details?: string) {
    super(
      `Database error during ${operation}`,
      'DATABASE_ERROR',
      500,
      { operation, details }
    );
  }
}

/**
 * Configuration errors (500)
 * Use when environment variables or config is missing
 */
export class ConfigurationError extends AppError {
  constructor(configKey: string) {
    super(
      `Missing or invalid configuration: ${configKey}`,
      'CONFIG_ERROR',
      500,
      { configKey }
    );
  }
}
```

---

### File 2: Create `lib/error-handler.ts`

**Purpose:** Centralized error handling logic for API routes

**Full file content:**

```typescript
import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { logger } from './logger';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Standardized error response format
 */
export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  metadata?: Record<string, unknown>;
}

/**
 * Convert Supabase PostgrestError to AppError
 */
export function handleSupabaseError(error: PostgrestError, operation: string): AppError {
  const { DatabaseError } = require('./errors');

  logger.error('Supabase error', {
    operation,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return new DatabaseError(operation, error.message);
}

/**
 * Main error handler for API routes
 * Use this in all catch blocks
 */
export function handleApiError(err: unknown): NextResponse<ErrorResponse> {
  // Handle known AppError instances
  if (err instanceof AppError) {
    logger.error(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      metadata: err.metadata,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        metadata: err.metadata,
      },
      { status: err.statusCode }
    );
  }

  // Handle standard Error instances
  if (err instanceof Error) {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        metadata: { originalMessage: err.message },
      },
      { status: 500 }
    );
  }

  // Handle unknown error types (should be rare after type safety migration)
  logger.error('Unknown error type', { error: String(err) });

  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    },
    { status: 500 }
  );
}

/**
 * Async wrapper for API route handlers
 * Automatically catches errors and applies handleApiError
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err: unknown) {
      return handleApiError(err);
    }
  };
}
```

---

## Phase 2: API Route Migration

### Batch 1: Core Analysis Routes (4 files) - 30 minutes

#### File 1: `app/api/analyze/route.ts`

**Import additions (add at top):**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes to make:**

1. **Line ~40 - Auth check:**
```typescript
// BEFORE
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// AFTER
if (!userId) {
  throw new AuthenticationError();
}
```

2. **Line ~60 - User lookup error:**
```typescript
// BEFORE
if (userError) {
  logger.error('Error fetching user', { error: userError });
  return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
}

// AFTER
if (userError) {
  throw handleSupabaseError(userError, 'fetch user');
}
```

3. **Line ~70 - User not found:**
```typescript
// BEFORE
if (!user) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

// AFTER
if (!user) {
  throw new NotFoundError('User', userId);
}
```

4. **Line ~90 - Request body validation:**
```typescript
// BEFORE
if (!body.image) {
  return NextResponse.json({ error: 'Image is required' }, { status: 400 });
}

// AFTER
if (!body.image) {
  throw new ValidationError('Image is required', { field: 'image' });
}
```

5. **Line ~140 - Usage limit check:**
```typescript
// BEFORE
if (usageCheck.analyses_this_month >= usageCheck.monthly_limit) {
  return NextResponse.json(
    { error: 'Monthly analysis limit reached' },
    { status: 429 }
  );
}

// AFTER
if (usageCheck.analyses_this_month >= usageCheck.monthly_limit) {
  throw new RateLimitError(
    'Monthly analysis limit reached. Please upgrade your plan.',
    {
      limit: usageCheck.monthly_limit,
      current: usageCheck.analyses_this_month,
    }
  );
}
```

6. **Line ~250 - OpenAI API error (inside retry loop):**
```typescript
// BEFORE
throw new Error(`Analysis failed: ${error.message}`);

// AFTER
throw new ExternalServiceError('OpenAI', error);
```

7. **Line ~300 - Database save error:**
```typescript
// BEFORE
if (saveError) {
  logger.error('Failed to save analysis', { error: saveError });
  return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
}

// AFTER
if (saveError) {
  throw handleSupabaseError(saveError, 'save analysis');
}
```

8. **Line ~350 - Main catch block:**
```typescript
// BEFORE
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Analysis failed', { error });
  return NextResponse.json(
    { error: 'Failed to analyze label' },
    { status: 500 }
  );
}

// AFTER
} catch (err: unknown) {
  return handleApiError(err);
}
```

---

#### File 2: `app/api/analyze/chat/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ExternalServiceError
} from '@/lib/error-handler';
```

**Changes:**

1. **Line ~30 - Auth check:**
```typescript
// BEFORE
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// AFTER
if (!userId) {
  throw new AuthenticationError();
}
```

2. **Line ~50 - Request validation:**
```typescript
// BEFORE
if (!body.message || !body.analysisId) {
  return NextResponse.json({ error: 'Message and analysisId required' }, { status: 400 });
}

// AFTER
if (!body.message) {
  throw new ValidationError('Message is required', { field: 'message' });
}
if (!body.analysisId) {
  throw new ValidationError('Analysis ID is required', { field: 'analysisId' });
}
```

3. **Line ~80 - Analysis not found:**
```typescript
// BEFORE
if (!analysis) {
  return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
}

// AFTER
if (!analysis) {
  throw new NotFoundError('Analysis', body.analysisId);
}
```

4. **Line ~150 - OpenAI error:**
```typescript
// BEFORE
throw new Error(`Chat failed: ${error.message}`);

// AFTER
throw new ExternalServiceError('OpenAI Chat', error);
```

5. **Line ~269 - Main catch block:**
```typescript
// BEFORE
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Chat analysis failed', { error });
  return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
}

// AFTER
} catch (err: unknown) {
  return handleApiError(err);
}
```

---

#### File 3: `app/api/analyze/text/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ExternalServiceError
} from '@/lib/error-handler';
```

**Changes:**

1. **Line ~30 - Auth check:**
```typescript
// BEFORE
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// AFTER
if (!userId) {
  throw new AuthenticationError();
}
```

2. **Line ~50 - Request validation:**
```typescript
// BEFORE
if (!body.text && !body.pdf) {
  return NextResponse.json({ error: 'Text or PDF required' }, { status: 400 });
}

// AFTER
if (!body.text && !body.pdf) {
  throw new ValidationError('Either text or PDF is required', {
    fields: ['text', 'pdf']
  });
}
```

3. **Line ~314 - Main catch block:**
```typescript
// BEFORE
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Text analysis failed', { error });
  return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
}

// AFTER
} catch (err: unknown) {
  return handleApiError(err);
}
```

---

#### File 4: `app/api/analyze/check-quality/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError
} from '@/lib/error-handler';
```

**Changes:**

1. **Line ~15 - Auth check:**
```typescript
// BEFORE
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// AFTER
if (!userId) {
  throw new AuthenticationError();
}
```

2. **Line ~20 - Request validation:**
```typescript
// BEFORE
if (!body.image) {
  return NextResponse.json({ error: 'Image required' }, { status: 400 });
}

// AFTER
if (!body.image) {
  throw new ValidationError('Image is required', { field: 'image' });
}
```

3. **Line ~24 - Main catch block:**
```typescript
// BEFORE
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Quality check failed', { error });
  return NextResponse.json({ error: 'Failed to check quality' }, { status: 500 });
}

// AFTER
} catch (err: unknown) {
  return handleApiError(err);
}
```

---

### Batch 2: Supporting Routes (7 files) - 30 minutes

#### File 5: `app/api/analyze/select-category/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:**
```typescript
// BEFORE
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// AFTER
if (!userId) {
  throw new AuthenticationError();
}
```

2. **Request validation:**
```typescript
// BEFORE
if (!body.category) {
  return NextResponse.json({ error: 'Category required' }, { status: 400 });
}

// AFTER
if (!body.category) {
  throw new ValidationError('Category is required', { field: 'category' });
}
```

3. **Main catch block:** Replace with `return handleApiError(err);`

---

#### File 6: `app/api/share/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:** `throw new AuthenticationError();`
2. **Request validation:** `throw new ValidationError('Analysis ID is required', { field: 'analysisId' });`
3. **Analysis not found:** `throw new NotFoundError('Analysis', body.analysisId);`
4. **Database errors:** `throw handleSupabaseError(error, 'generate share token');`
5. **Main catch block:** `return handleApiError(err);`

---

#### File 7: `app/api/create-checkout-session/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  ExternalServiceError,
  ConfigurationError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:** `throw new AuthenticationError();`
2. **Stripe key validation:**
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  throw new ConfigurationError('STRIPE_SECRET_KEY');
}
```
3. **Price ID validation:**
```typescript
if (!priceId) {
  throw new ValidationError('Invalid plan selected', { plan: body.plan });
}
```
4. **Stripe API error:** `throw new ExternalServiceError('Stripe', error);`
5. **Main catch block:** `return handleApiError(err);`

---

#### File 8: `app/api/organizations/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:** `throw new AuthenticationError();`
2. **Validation:**
```typescript
if (!body.name) {
  throw new ValidationError('Organization name is required', { field: 'name' });
}
```
3. **Database errors:** `throw handleSupabaseError(error, 'create organization');`
4. **Main catch block:** `return handleApiError(err);`

---

#### File 9: `app/api/organizations/members/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:** `throw new AuthenticationError();`
2. **Permission check:**
```typescript
if (role !== 'owner' && role !== 'admin') {
  throw new AuthorizationError('Only owners and admins can manage members');
}
```
3. **Validation:**
```typescript
if (!body.email) {
  throw new ValidationError('Email is required', { field: 'email' });
}
```
4. **Database errors:** `throw handleSupabaseError(error, operation);`
5. **Main catch blocks:** `return handleApiError(err);`

---

#### File 10: `app/api/accept-invitation/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  NotFoundError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes:**

1. **Validation:**
```typescript
if (!token) {
  throw new ValidationError('Invitation token is required', { field: 'token' });
}
```
2. **Invitation not found:**
```typescript
if (!invitation) {
  throw new NotFoundError('Invitation', token);
}
```
3. **Database errors:** `throw handleSupabaseError(error, operation);`
4. **Main catch block:** `return handleApiError(err);`

---

#### File 11: `app/api/export/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  handleSupabaseError
} from '@/lib/error-handler';
```

**Changes:**

1. **Auth check:** `throw new AuthenticationError();`
2. **Validation:**
```typescript
if (!format || !['pdf', 'csv', 'json'].includes(format)) {
  throw new ValidationError('Invalid export format', {
    field: 'format',
    validValues: ['pdf', 'csv', 'json']
  });
}
```
3. **Analysis not found:** `throw new NotFoundError('Analysis', analysisId);`
4. **Database errors:** `throw handleSupabaseError(error, 'track export');`
5. **Main catch block:** `return handleApiError(err);`

---

### Batch 3: Admin Routes (11 files) - 45 minutes

**Pattern for ALL admin routes:**

```typescript
// Import additions
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  handleSupabaseError
} from '@/lib/error-handler';

// Auth check
if (!userId) {
  throw new AuthenticationError();
}

// Admin role check
const { data: user } = await supabase
  .from('users')
  .select('role')
  .eq('clerk_user_id', userId)
  .single();

if (!user || user.role !== 'admin') {
  throw new AuthorizationError('Admin access required');
}

// Validation errors
if (!body.field) {
  throw new ValidationError('Field is required', { field: 'field' });
}

// Not found errors
if (!data) {
  throw new NotFoundError('Resource', id);
}

// Database errors
if (error) {
  throw handleSupabaseError(error, 'operation description');
}

// Main catch block
} catch (err: unknown) {
  return handleApiError(err);
}
```

**Files to update:**

1. `app/api/admin/stats/route.ts` - Line 82
2. `app/api/admin/subscriptions/route.ts` - Line 68
3. `app/api/admin/users/route.ts` - Line 62
4. `app/api/admin/users/[id]/route.ts` - Lines 65, 77
5. `app/api/admin/documents/route.ts` - Lines 33, 75
6. `app/api/admin/documents/[id]/route.ts` - Lines 41, 77
7. `app/api/admin/documents/extract-pdf/route.ts` - Line 59
8. `app/api/admin/documents/categories/route.ts` - Line 31

**Each file follows the same pattern - replace current error handling with the pattern above.**

---

### Batch 4: Webhook Routes (2 files) - 15 minutes

#### File 12: `app/api/webhooks/clerk/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  ExternalServiceError
} from '@/lib/error-handler';
```

**Changes:**

1. **Webhook signature validation:**
```typescript
// BEFORE
if (!process.env.CLERK_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
}

// AFTER
if (!process.env.CLERK_WEBHOOK_SECRET) {
  throw new ConfigurationError('CLERK_WEBHOOK_SECRET');
}
```

2. **Webhook verification error:**
```typescript
// BEFORE
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('Error verifying webhook', { error });
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}

// AFTER
} catch (err: unknown) {
  if (err instanceof Error && err.message.includes('signature')) {
    throw new ValidationError('Invalid webhook signature');
  }
  throw err;
}
```

3. **Main catch block:** `return handleApiError(err);`

---

#### File 13: `app/api/webhooks/stripe/route.ts`

**Import additions:**
```typescript
import {
  handleApiError,
  ValidationError,
  ExternalServiceError,
  ConfigurationError
} from '@/lib/error-handler';
```

**Changes:**

1. **Webhook secret check:**
```typescript
if (!webhookSecret) {
  throw new ConfigurationError('STRIPE_WEBHOOK_SECRET');
}
```

2. **Signature validation:**
```typescript
} catch (err: unknown) {
  if (err instanceof Error && err.message.includes('signature')) {
    throw new ValidationError('Invalid webhook signature');
  }
  throw err;
}
```

3. **Main catch blocks (2):** `return handleApiError(err);`

---

## Phase 3: Frontend Integration

### Component 1: Create `components/ErrorAlert.tsx`

**Full file content:**

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  code?: string;
  variant?: 'destructive' | 'warning' | 'info';
}

export function ErrorAlert({
  title = 'Error',
  message,
  code,
  variant = 'destructive'
}: ErrorAlertProps) {
  const Icon = variant === 'warning' ? AlertTriangle : variant === 'info' ? Info : AlertCircle;

  return (
    <Alert variant={variant === 'info' ? 'default' : variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {message}
        {code && (
          <span className="block text-xs text-muted-foreground mt-1">
            Error code: {code}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

---

### Component 2: Update `app/analyze/page.tsx`

**Add error state:**
```typescript
const [error, setError] = useState<string>('');
const [errorCode, setErrorCode] = useState<string>('');
```

**Update analyzeLabel function:**
```typescript
// BEFORE
if (!response.ok) {
  setError('Failed to analyze label. Please try again.');
  return;
}

// AFTER
if (!response.ok) {
  const errorData = await response.json();
  setError(errorData.error || 'Failed to analyze label');
  setErrorCode(errorData.code || '');

  // Handle specific error codes
  if (errorData.code === 'RATE_LIMIT') {
    setError(`${errorData.error} (${errorData.metadata?.current}/${errorData.metadata?.limit} analyses used)`);
  }
  return;
}
```

**Add ErrorAlert to render:**
```typescript
{error && (
  <ErrorAlert
    message={error}
    code={errorCode}
    variant={errorCode === 'RATE_LIMIT' ? 'warning' : 'destructive'}
  />
)}
```

---

### Component 3: Update `components/AnalysisChat.tsx`

**Changes:**
```typescript
// Add error state
const [error, setError] = useState<string>('');
const [errorCode, setErrorCode] = useState<string>('');

// Update handleSendMessage
if (!response.ok) {
  const errorData = await response.json();
  setError(errorData.error || 'Failed to send message');
  setErrorCode(errorData.code || '');
  return;
}

// Add ErrorAlert in render
{error && <ErrorAlert message={error} code={errorCode} />}
```

---

### Component 4: Update `components/TextChecker.tsx`

**Same pattern as AnalysisChat - add error state and ErrorAlert.**

---

## Verification Checklist

After completing all phases:

### ✅ Phase 1: Foundation
- [ ] `lib/errors.ts` created with all error classes
- [ ] `lib/error-handler.ts` created with handleApiError function
- [ ] Run `npm run typecheck` - should pass with 0 errors

### ✅ Phase 2: API Routes
**Batch 1: Core Analysis**
- [ ] `app/api/analyze/route.ts` - 8 changes
- [ ] `app/api/analyze/chat/route.ts` - 5 changes
- [ ] `app/api/analyze/text/route.ts` - 3 changes
- [ ] `app/api/analyze/check-quality/route.ts` - 3 changes

**Batch 2: Supporting**
- [ ] `app/api/analyze/select-category/route.ts` - 3 changes
- [ ] `app/api/share/route.ts` - 5 changes
- [ ] `app/api/create-checkout-session/route.ts` - 5 changes
- [ ] `app/api/organizations/route.ts` - 3 changes
- [ ] `app/api/organizations/members/route.ts` - 5 changes
- [ ] `app/api/accept-invitation/route.ts` - 4 changes
- [ ] `app/api/export/route.ts` - 5 changes

**Batch 3: Admin (11 files)**
- [ ] All admin routes updated with auth/authorization checks
- [ ] All use handleApiError in catch blocks

**Batch 4: Webhooks**
- [ ] `app/api/webhooks/clerk/route.ts` - 3 changes
- [ ] `app/api/webhooks/stripe/route.ts` - 3 changes

### ✅ Phase 3: Frontend
- [ ] `components/ErrorAlert.tsx` created
- [ ] `app/analyze/page.tsx` updated with error handling
- [ ] `components/AnalysisChat.tsx` updated
- [ ] `components/TextChecker.tsx` updated

### ✅ Testing
- [ ] Run `npm run typecheck` - 0 errors
- [ ] Run `npm run build` - successful
- [ ] Test analysis with invalid inputs (validation errors)
- [ ] Test analysis without auth (authentication error)
- [ ] Test analysis over limit (rate limit error)
- [ ] Check logs show structured error information

---

## Expected Outcomes

### Before Migration
```
❌ Inconsistent error messages
❌ No error codes for debugging
❌ Generic 500 errors for everything
❌ Poor monitoring capabilities
❌ Unclear error causes
```

### After Migration
```
✅ Consistent error format across all endpoints
✅ Error codes for filtering and monitoring
✅ Proper HTTP status codes (400, 401, 403, 404, 429, 500, 502)
✅ Detailed metadata for debugging
✅ Better UX with specific error messages
✅ Type-safe error handling
✅ Centralized error logging
```

---

## Message for Cursor

```
Error Handling Migration - Phase 1 Foundation

Create the error handling foundation:

1. Create lib/errors.ts with custom error classes (AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError, ExternalServiceError, DatabaseError, ConfigurationError)

2. Create lib/error-handler.ts with centralized error handling (handleApiError, handleSupabaseError, withErrorHandling)

3. Run typecheck to verify foundation builds correctly

See ERROR_HANDLING_MIGRATION_GUIDE.md for complete file contents.

This establishes the error handling system that we'll use across all API routes.
```

---

## Time Estimates

- **Phase 1 (Foundation):** 15-20 minutes
- **Phase 2 Batch 1 (Core Analysis):** 30 minutes
- **Phase 2 Batch 2 (Supporting):** 30 minutes
- **Phase 2 Batch 3 (Admin):** 45 minutes
- **Phase 2 Batch 4 (Webhooks):** 15 minutes
- **Phase 3 (Frontend):** 30 minutes

**Total: 2.5-3 hours**

---

## Notes

- All error handling builds on the type safety foundation completed in previous session
- Error codes can be used for monitoring dashboards (track errors by code)
- Metadata fields provide debugging context without exposing internal details
- Frontend error handling improves UX with specific, actionable messages
- Centralized logging makes it easy to track errors in production

Let's start with Phase 1! 🚀
```
