# Batch 7: Remaining API Routes Migration Guide

**Files:** 11 API route files
**Total Instances:** 14
**Time Estimate:** 15 minutes
**Priority:** MEDIUM - Admin endpoints + remaining analysis routes

---

## Pattern (Same as Batch 4)

All 14 instances are error handlers following the same pattern:

**Before:**
```typescript
} catch (error: any) {
  logger.error('...', { error });
  return NextResponse.json({ error: '...' }, { status: 500 });
}
```

**After:**
```typescript
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error('...', { error });
  return NextResponse.json({ error: '...' }, { status: 500 });
}
```

---

## Files to Fix

### Analysis Routes (3 instances)

1. **app/api/analyze/chat/route.ts** - Line 269
2. **app/api/analyze/text/route.ts** - Line 314
3. **app/api/analyze/check-quality/route.ts** - Line 24

### Admin API Routes (11 instances)

4. **app/api/admin/stats/route.ts** - Line 82
5. **app/api/admin/subscriptions/route.ts** - Line 68
6. **app/api/admin/users/route.ts** - Line 62
7. **app/api/admin/users/[id]/route.ts** - Lines 65, 77 (2 instances)
8. **app/api/admin/documents/route.ts** - Lines 33, 75 (2 instances)
9. **app/api/admin/documents/[id]/route.ts** - Lines 41, 77 (2 instances)
10. **app/api/admin/documents/extract-pdf/route.ts** - Line 59
11. **app/api/admin/documents/categories/route.ts** - Line 31

---

## Detailed Fixes

### Fix 1-3: Analysis Routes

**app/api/analyze/chat/route.ts (Line 269):**
```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Chat analysis failed', { error });
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Chat analysis failed', { error });
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
```

**app/api/analyze/text/route.ts (Line 314):**
```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Text analysis failed', { error });
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Text analysis failed', { error });
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }
```

**app/api/analyze/check-quality/route.ts (Line 24):**
```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Quality check failed', { error });
    return NextResponse.json({ error: 'Failed to check quality' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Quality check failed', { error });
    return NextResponse.json({ error: 'Failed to check quality' }, { status: 500 });
  }
```

---

### Fix 4-6: Admin Stats/Subscriptions/Users

**app/api/admin/stats/route.ts (Line 82):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

**app/api/admin/subscriptions/route.ts (Line 68):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

**app/api/admin/users/route.ts (Line 62):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

---

### Fix 7-8: Admin User Details

**app/api/admin/users/[id]/route.ts:**

**Line 65 (Clerk error):**
```typescript
// BEFORE
    } catch (clerkError: any) {

// AFTER
    } catch (err: unknown) {
      const clerkError = err instanceof Error ? err : new Error(String(err));
```

**Line 77 (Main error):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

---

### Fix 9-10: Admin Documents (GET/POST)

**app/api/admin/documents/route.ts:**

**Line 33 (GET error):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

**Line 75 (POST error):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

---

### Fix 11-12: Admin Documents (PUT/DELETE)

**app/api/admin/documents/[id]/route.ts:**

**Line 41 (PUT error):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

**Line 77 (DELETE error):**
```typescript
// BEFORE
  } catch (error: any) {

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
```

---

### Fix 13: PDF Extraction

**app/api/admin/documents/extract-pdf/route.ts (Line 59):**
```typescript
// BEFORE
  } catch (error: any) {
    logger.error('PDF extraction failed', { error });
    return NextResponse.json({ error: 'Failed to extract PDF' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('PDF extraction failed', { error });
    return NextResponse.json({ error: 'Failed to extract PDF' }, { status: 500 });
  }
```

---

### Fix 14: Document Categories

**app/api/admin/documents/categories/route.ts (Line 31):**
```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Failed to fetch document categories', { error });
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to fetch document categories', { error });
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
```

---

## Summary

**All 14 instances follow the identical pattern:**
1. Change `catch (error: any)` to `catch (err: unknown)`
2. Add type guard: `const error = err instanceof Error ? err : new Error(String(err));`
3. Continue using `error` variable as before

**No imports needed** - all files already have logger and NextResponse imported.

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Quick Checklist

**Analysis Routes:**
- [ ] app/api/analyze/chat/route.ts (1)
- [ ] app/api/analyze/text/route.ts (1)
- [ ] app/api/analyze/check-quality/route.ts (1)

**Admin Routes:**
- [ ] app/api/admin/stats/route.ts (1)
- [ ] app/api/admin/subscriptions/route.ts (1)
- [ ] app/api/admin/users/route.ts (1)
- [ ] app/api/admin/users/[id]/route.ts (2)
- [ ] app/api/admin/documents/route.ts (2)
- [ ] app/api/admin/documents/[id]/route.ts (2)
- [ ] app/api/admin/documents/extract-pdf/route.ts (1)
- [ ] app/api/admin/documents/categories/route.ts (1)

**Total:** 14 error handlers → Type-safe! 🔒

**Time:** ~15 minutes (same pattern repeated)

After this batch, only UI pages remain! 🎯
