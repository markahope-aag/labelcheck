# Batch 6: Helper Libraries Migration Guide

**Files:** 6 helper library files
**Total Instances:** 10
**Time Estimate:** 15 minutes
**Priority:** LOW - Utility functions, less critical than core workflow

---

## File 1: lib/regulatory-documents.ts (3 instances)

### Import Addition
```typescript
import type { PostgrestError } from '@supabase/supabase-js';
```

### Fix 1: Line 345 - createDocument Return Type
```typescript
// BEFORE
): Promise<{ data: RegulatoryDocument | null; error: any }> {

// AFTER
): Promise<{ data: RegulatoryDocument | null; error: PostgrestError | null }> {
```

### Fix 2: Line 363 - updateDocument Return Type
```typescript
// BEFORE
): Promise<{ data: RegulatoryDocument | null; error: any }> {

// AFTER
): Promise<{ data: RegulatoryDocument | null; error: PostgrestError | null }> {
```

### Fix 3: Line 379 - deactivateDocument Return Type
```typescript
// BEFORE
export async function deactivateDocument(id: string): Promise<{ error: any }> {

// AFTER
export async function deactivateDocument(id: string): Promise<{ error: PostgrestError | null }> {
```

---

## File 2: lib/pdf-helpers.ts (2 instances)

### Fix 4: Line 127 - uploadTask Filter
```typescript
// BEFORE
    const uploadTask = job.tasks.filter((task: any) => task.name === 'import-pdf')[0];

// AFTER
    const uploadTask = job.tasks.filter((task) => task.name === 'import-pdf')[0];
```

**Explanation:** CloudConvert SDK provides types for job.tasks, use type inference

### Fix 5: Line 134 - exportTask Filter
```typescript
// BEFORE
    const exportTask = completedJob.tasks.filter((task: any) => task.name === 'export-jpg')[0];

// AFTER
    const exportTask = completedJob.tasks.filter((task) => task.name === 'export-jpg')[0];
```

---

## File 3: lib/ndi-helpers.ts (2 instances)

### Fix 6: Line 26 - allData Array
```typescript
// BEFORE
    let allData: any[] = [];

// AFTER
    let allData: NDIIngredient[] = [];
```

**Note:** `NDIIngredient` type should already be imported at the top of the file

### Fix 7: Line 375 - ndiIngredients Array
```typescript
// BEFORE
  let ndiIngredients: any[] = [];

// AFTER
  let ndiIngredients: NDIIngredient[] = [];
```

---

## File 4: lib/performance-monitor.ts (1 instance)

### Fix 8: Line 41 - addMetadata Parameter
```typescript
// BEFORE
  addMetadata(key: string, value: any): void {

// AFTER
  addMetadata(key: string, value: string | number | boolean | null): void {
```

**Explanation:** Metadata values should be primitive types for logging/monitoring

---

## File 5: lib/logger.ts (1 instance)

### Fix 9: Line 113 - LogMetadata Interface
```typescript
// BEFORE
interface LogMetadata {
  [key: string]: any;
}

// AFTER
interface LogMetadata {
  [key: string]: unknown;
}
```

**Explanation:** Log metadata can be anything, but `unknown` is safer than `any` and forces type checking when accessing

---

## File 6: lib/client-logger.ts (1 instance)

### Fix 10: Line 19 - LogData Interface
```typescript
// BEFORE
interface LogData {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  [key: string]: any;
}

// AFTER
interface LogData {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  [key: string]: unknown;
}
```

**Explanation:** Same as logger.ts - `unknown` is safer for arbitrary log data

---

## Summary of Changes

### Regulatory Documents (3 fixes):
- All Supabase error types: `any` → `PostgrestError | null`

### PDF Helpers (2 fixes):
- CloudConvert task filters: Remove `: any`, use type inference

### NDI Helpers (2 fixes):
- Array types: `any[]` → `NDIIngredient[]`

### Performance Monitor (1 fix):
- Metadata value: `any` → `string | number | boolean | null`

### Loggers (2 fixes):
- Metadata/data interfaces: `[key: string]: any` → `[key: string]: unknown`

---

## Required Imports

**lib/regulatory-documents.ts:**
```typescript
import type { PostgrestError } from '@supabase/supabase-js';
```

All other files either have necessary imports or use type inference.

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Why `unknown` vs `any` for Loggers?

### Before (unsafe):
```typescript
interface LogMetadata {
  [key: string]: any; // Can do anything with values - no safety
}

function log(meta: LogMetadata) {
  meta.foo.bar.baz; // ❌ Compiles but crashes if foo is undefined
}
```

### After (type-safe):
```typescript
interface LogMetadata {
  [key: string]: unknown; // Must check type before using
}

function log(meta: LogMetadata) {
  meta.foo.bar.baz; // ✅ Compile error - must validate first

  if (typeof meta.foo === 'object' && meta.foo !== null) {
    // Now safe to access
  }
}
```

**Benefit:** Prevents crashes from unexpected log data structures while maintaining flexibility.

---

## Quick Checklist

- [ ] `lib/regulatory-documents.ts`: 3 Supabase error types
- [ ] `lib/pdf-helpers.ts`: 2 task filters (type inference)
- [ ] `lib/ndi-helpers.ts`: 2 array types
- [ ] `lib/performance-monitor.ts`: 1 metadata parameter
- [ ] `lib/logger.ts`: 1 interface index signature
- [ ] `lib/client-logger.ts`: 1 interface index signature

**Total time:** ~15 minutes for all 10 instances

All helper utilities will be type-safe! 🛠️
