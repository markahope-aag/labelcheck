# HIGH Priority Files Migration Guide

Quick reference for migrating the remaining 3 HIGH priority files with `any` types.

## File 1: app/share/[token]/page.tsx (3 instances)

### Line 48 - Error Handling
```typescript
// BEFORE
} catch (err: any) {
  console.error('Error loading shared analysis:', err);
  setError('Failed to load analysis');
}

// AFTER
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('Error loading shared analysis:', error);
  setError('Failed to load analysis');
}
```

### Line 220 - Compliance Table Map
```typescript
// BEFORE
{result.compliance_table.map((row: any, idx: number) => (

// AFTER
import type { ComplianceTableRow } from '@/types';
{result.compliance_table.map((row: ComplianceTableRow, idx: number) => (
```

### Line 258 - Recommendations Map
```typescript
// BEFORE
{result.recommendations.map((rec: any, index: number) => (

// AFTER
import type { Recommendation } from '@/types';
{result.recommendations.map((rec: Recommendation, index: number) => (
```

### Import Statement
Add at the top of the file:
```typescript
import type { ComplianceTableRow, Recommendation } from '@/types';
```

---

## File 2: app/history/page.tsx (3 instances)

### Line 248 - Function Parameter
```typescript
// BEFORE
function openDeleteDialog(analysis: any) {
  setAnalysisToDelete(analysis);
  setDeleteDialogOpen(true);
}

// AFTER
import type { Analysis } from '@/types';
function openDeleteDialog(analysis: Analysis) {
  setAnalysisToDelete(analysis);
  setDeleteDialogOpen(true);
}
```

### Line 415 - Select onValueChange
```typescript
// BEFORE
onValueChange={(value: any) => {
  setComplianceFilter(value as 'all' | 'compliant' | 'non_compliant' | 'minor_issues');
}}

// AFTER
onValueChange={(value: string) => {
  setComplianceFilter(value as 'all' | 'compliant' | 'non_compliant' | 'minor_issues');
}}
```

### Line 623 - Recommendations Map
```typescript
// BEFORE
.map((rec: any, index: number) => {

// AFTER
import type { Recommendation } from '@/types';
.map((rec: Recommendation, index: number) => {
```

### Import Statement
Add at the top of the file:
```typescript
import type { Analysis, Recommendation } from '@/types';
```

---

## File 3: app/analysis/[id]/page.tsx (13 instances)

### Import Statement
Add at the top of the file:
```typescript
import type {
  AnalysisIteration,
  Recommendation,
  ComplianceTableRow,
  OtherRequirement
} from '@/types';
```

### Line 120 - Iteration Mapping
```typescript
// BEFORE
const messages = iterations.flatMap((iter: any) => [

// AFTER
const messages = iterations.flatMap((iter: AnalysisIteration) => [
```

### Lines 135, 181 - Error Handling
```typescript
// BEFORE
} catch (err: any) {
  console.error('Error:', err);
}

// AFTER
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('Error:', error);
}
```

### Lines 354, 357, 360, 363, 367, 369 - Recommendation Filtering
```typescript
// BEFORE
result.recommendations.filter((r: any) => r.priority === 'critical')
result.recommendations.filter((r: any) => r.priority === 'high')
result.recommendations.filter((r: any) => r.priority === 'medium')
result.recommendations.filter((r: any) => r.priority === 'low')

// AFTER
result.recommendations.filter((r: Recommendation) => r.priority === 'critical')
result.recommendations.filter((r: Recommendation) => r.priority === 'high')
result.recommendations.filter((r: Recommendation) => r.priority === 'medium')
result.recommendations.filter((r: Recommendation) => r.priority === 'low')
```

### Line 551 - Ingredient-Specific Recommendation
```typescript
// BEFORE
(r: any) => r.ingredient === ingredient

// AFTER
(r: Recommendation) => r.ingredient === ingredient
```

### Line 894 - Additional Requirements Map
```typescript
// BEFORE
(req: any, idx: number) => (

// AFTER
(req: OtherRequirement, idx: number) => (
```

### Line 940 - Compliance Table Map
```typescript
// BEFORE
{result.compliance_table.map((row: any, idx: number) => (

// AFTER
{result.compliance_table.map((row: ComplianceTableRow, idx: number) => (
```

### Line 978 - Recommendations Map
```typescript
// BEFORE
{result.recommendations.map((rec: any, index: number) => (

// AFTER
{result.recommendations.map((rec: Recommendation, index: number) => (
```

---

## Summary

### Total Changes by File:
- **app/share/[token]/page.tsx**: 3 changes (1 error, 2 maps)
- **app/history/page.tsx**: 3 changes (1 function param, 1 select, 1 map)
- **app/analysis/[id]/page.tsx**: 13 changes (2 errors, 1 flatMap, 10 filters/maps)

### Common Types Needed:
- `AnalysisIteration` - For iteration mapping
- `Recommendation` - For recommendation filtering/mapping (most common)
- `ComplianceTableRow` - For compliance table rendering
- `OtherRequirement` - For additional requirements
- `Analysis` - For analysis objects (history page)

### Verification:
After making all changes, run:
```bash
npm run typecheck
```

Should still pass with 0 errors!

---

## Quick Workflow:

1. **app/share/[token]/page.tsx**
   - Add imports
   - Fix error handler (line 48)
   - Fix 2 maps (lines 220, 258)
   - ✅ Verify typecheck

2. **app/history/page.tsx**
   - Add imports
   - Fix function param (line 248)
   - Fix select callback (line 415)
   - Fix map (line 623)
   - ✅ Verify typecheck

3. **app/analysis/[id]/page.tsx**
   - Add imports
   - Fix 2 error handlers (lines 135, 181)
   - Fix iteration flatMap (line 120)
   - Fix 10 recommendation operations (lines 354-978)
   - Fix compliance table map (line 940)
   - Fix requirements map (line 894)
   - ✅ Verify typecheck

All changes are simple type annotations - no structural changes needed!
