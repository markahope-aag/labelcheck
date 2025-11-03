# Batch 4: Simple API Routes Migration Guide

**Files:** 6 API route files
**Total Instances:** 11
**Time Estimate:** 20 minutes
**Priority:** HIGH - User-facing API endpoints

---

## Overview

All fixes in this batch follow the same pattern: **Error handler type guards**

**Pattern:** Replace `catch (error: any)` with `catch (err: unknown)` + type guard

---

## File 1: app/api/analyze/route.ts (3 instances)

### Fix 1: Line 45 - Main POST Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Analysis failed', { error: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Analysis failed', { error: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
```

---

### Fix 2: Line 122 - analysisData Type

```typescript
// BEFORE
    let analysisData: any;

// AFTER
    let analysisData: AnalysisResult;
```

**Add import at top:**
```typescript
import type { AnalysisResult } from '@/types';
```

---

### Fix 3: Line 187 - Another Error Handler

```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

---

## File 2: app/api/analyze/select-category/route.ts (1 instance)

### Fix 4: Line 75 - Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Category selection failed', { error });
    return NextResponse.json(
      { error: 'Failed to update category selection' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Category selection failed', { error });
    return NextResponse.json(
      { error: 'Failed to update category selection' },
      { status: 500 }
    );
  }
```

---

## File 3: app/api/share/route.ts (1 instance)

### Fix 5: Line 83 - Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Failed to create share link', { error });
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to create share link', { error });
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
```

---

## File 4: app/api/create-checkout-session/route.ts (1 instance)

### Fix 6: Line 97 - Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Stripe checkout session creation failed', { error });
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Stripe checkout session creation failed', { error });
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
```

---

## File 5: app/api/organizations/route.ts (1 instance)

### Fix 7: Line 102 - Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Failed to create organization', { error });
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to create organization', { error });
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
```

---

## File 6: app/api/organizations/members/route.ts (4 instances)

### Fix 8: Line 86 - GET Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Failed to fetch organization members', { error });
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to fetch organization members', { error });
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
```

---

### Fix 9: Line 277 - Email Error Handler (nested)

```typescript
// BEFORE
        } catch (emailError: any) {
          logger.error('Failed to send invitation email', { error: emailError });
          // Don't fail the whole operation if email fails
        }

// AFTER
        } catch (err: unknown) {
          const emailError = err instanceof Error ? err : new Error(String(err));
          logger.error('Failed to send invitation email', { error: emailError });
          // Don't fail the whole operation if email fails
        }
```

---

### Fix 10: Line 299 - POST Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Failed to invite member', { error });
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to invite member', { error });
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
```

---

## Summary of Changes

### Pattern (repeated 11 times):

**Before:**
```typescript
} catch (error: any) {
  logger.error('...', { error });
  // ... use error.message
}
```

**After:**
```typescript
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('...', { error });
  // ... use error.message
}
```

### Files Changed:
1. ✅ `app/api/analyze/route.ts` (3 fixes: 2 error handlers + 1 type annotation)
2. ✅ `app/api/analyze/select-category/route.ts` (1 error handler)
3. ✅ `app/api/share/route.ts` (1 error handler)
4. ✅ `app/api/create-checkout-session/route.ts` (1 error handler)
5. ✅ `app/api/organizations/route.ts` (1 error handler)
6. ✅ `app/api/organizations/members/route.ts` (4 error handlers)

---

## Required Imports

Only one file needs an import addition:

**app/api/analyze/route.ts:**
```typescript
import type { AnalysisResult } from '@/types';
```

All other files already have necessary imports (logger, NextResponse, etc.)

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Why This Matters

### Before (unsafe):
```typescript
catch (error: any) {
  // TypeScript allows ANY operations - no safety
  error.foo.bar.baz // ❌ No error at compile time, crashes at runtime
  error.message // Works if error is Error, crashes if it's a string/number
}
```

### After (type-safe):
```typescript
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  // TypeScript knows error is always an Error instance
  error.message // ✅ Always works, never crashes
  error.foo // ✅ Compile error - property doesn't exist
}
```

**Real Impact:** API endpoints won't crash when unexpected errors occur. Error logging is always reliable.

---

## Quick Checklist

For each file:
- [ ] Replace `catch (error: any)` with `catch (err: unknown)`
- [ ] Add type guard: `const error = err instanceof Error ? err : new Error(String(err));`
- [ ] Verify all `error.message` accesses still work
- [ ] Run typecheck

**Total time:** ~20 minutes for all 11 instances

This is straightforward - same pattern everywhere! 🚀
