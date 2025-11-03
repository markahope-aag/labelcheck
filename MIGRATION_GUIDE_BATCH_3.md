# Batch 3: Post-Processing & Export Migration Guide

**Files:**
1. `lib/analysis/post-processor.ts` (6 instances)
2. `lib/export-helpers.ts` (6 instances)

**Total Instances:** 12
**Time Estimate:** 20 minutes
**Priority:** MEDIUM - Enhancement and export features

---

## Part 1: lib/analysis/post-processor.ts (6 instances)

### Import Additions

Add these imports at the top of the file (after existing imports around line 14):

```typescript
import type { GRASCompliance, AllergenDatabase } from '@/types';
```

### Fix 1: Lines 40-42 - AnalysisData Interface Properties

```typescript
// BEFORE
export interface AnalysisData {
  // ... other properties
  gras_compliance?: any;
  ndi_compliance?: any;
  allergen_database_check?: any;
}

// AFTER
export interface AnalysisData {
  // ... other properties
  gras_compliance?: GRASCompliance;
  ndi_compliance?: {
    summary: {
      totalIngredients: number;
      withNDI: number;
      withoutNDI: number;
      requiresNotification: number;
    };
    results?: Array<{
      ingredient: string;
      requiresNDI: boolean;
      complianceNote: string;
    }>;
  };
  allergen_database_check?: AllergenDatabase;
}
```

**Explanation:**
- `GRASCompliance` and `AllergenDatabase` types are already defined in `@/types`
- NDI compliance has a specific structure returned by `checkNDICompliance()` helper

---

### Fix 2: Line 214 - processNDICompliance Filter

```typescript
// BEFORE
        ndiCompliance.results
          .filter((result: any) => result.requiresNDI)

// AFTER
        ndiCompliance.results
          .filter((result) => result.requiresNDI)
```

**Explanation:** TypeScript can infer the type from the NDI compliance structure defined above

---

### Fix 3: Line 215 - processNDICompliance ForEach

```typescript
// BEFORE
          .forEach((result: any) => {

// AFTER
          .forEach((result) => {
```

---

### Fix 4: Line 281 - processAllergenCompliance Map

```typescript
// BEFORE
        const detectedAllergenNames = allergenResults.allergensDetected.map(
          (a: any) => a.allergen_name
        );

// AFTER
        const detectedAllergenNames = allergenResults.allergensDetected.map(
          (a) => a.allergen_name
        );
```

**Explanation:** `checkIngredientsForAllergens()` returns a typed result with `allergensDetected` array, so TypeScript can infer the type

---

## Part 2: lib/export-helpers.ts (6 instances)

### Import Additions

Add these imports at the top of the file:

```typescript
import type { AnalysisResult, Recommendation, ComplianceTableRow } from '@/types';
```

### Fix 5: Line 4 - AnalysisData Interface

```typescript
// BEFORE
interface AnalysisData {
  id: string;
  image_name: string;
  analysis_result: any; // New regulatory analysis schema
  compliance_status: string;
  issues_found: number;
  created_at: string;
}

// AFTER
interface AnalysisData {
  id: string;
  image_name: string;
  analysis_result: AnalysisResult;
  compliance_status: string;
  issues_found: number;
  created_at: string;
}
```

---

### Fix 6: Line 25 - generateCSV Recommendation Filter

```typescript
// BEFORE
      result.recommendations?.filter((r: any) => r.priority === 'critical' || r.priority === 'high')

// AFTER
      result.recommendations?.filter((r: Recommendation) => r.priority === 'critical' || r.priority === 'high')
```

---

### Fix 7: Line 110 - generateJSON Recommendation Filter

Find the similar filter in `generateJSON` function:

```typescript
// BEFORE
          (r: any) => r.priority === 'critical' || r.priority === 'high'

// AFTER
          (r: Recommendation) => r.priority === 'critical' || r.priority === 'high'
```

---

### Fix 8: Line 165 - generatePDF Recommendations ForEach

```typescript
// BEFORE
      result.recommendations.slice(0, 3).forEach((rec: any) => {

// AFTER
      result.recommendations.slice(0, 3).forEach((rec: Recommendation) => {
```

---

### Fix 9: Line 279 - generatePDF Compliance Table Map

```typescript
// BEFORE
      body: result.compliance_table.map((row: any) => [row.element, row.status, row.rationale]),

// AFTER
      body: result.compliance_table.map((row: ComplianceTableRow) => [row.element, row.status, row.rationale]),
```

---

### Fix 10: Line 471 - generatePDF All Recommendations ForEach

Find the recommendations forEach in the full recommendations section:

```typescript
// BEFORE
    result.recommendations.forEach((rec: any, index: number) => {

// AFTER
    result.recommendations.forEach((rec: Recommendation, index: number) => {
```

---

## Summary of Changes

### lib/analysis/post-processor.ts (6 instances)
- **Line 40:** `gras_compliance?: any` → `gras_compliance?: GRASCompliance`
- **Line 41:** `ndi_compliance?: any` → proper NDI compliance type
- **Line 42:** `allergen_database_check?: any` → `allergen_database_check?: AllergenDatabase`
- **Line 214:** `(result: any)` → `(result)` (type inference)
- **Line 215:** `(result: any)` → `(result)` (type inference)
- **Line 281:** `(a: any)` → `(a)` (type inference)

### lib/export-helpers.ts (6 instances)
- **Line 4:** `analysis_result: any` → `analysis_result: AnalysisResult`
- **Line 25:** `(r: any)` → `(r: Recommendation)` in generateCSV
- **Line 110:** `(r: any)` → `(r: Recommendation)` in generateJSON
- **Line 165:** `(rec: any)` → `(rec: Recommendation)` in generatePDF
- **Line 279:** `(row: any)` → `(row: ComplianceTableRow)` in generatePDF
- **Line 471:** `(rec: any)` → `(rec: Recommendation)` in generatePDF

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Complete Type Definitions

### lib/analysis/post-processor.ts

```typescript
import type { GRASCompliance, AllergenDatabase } from '@/types';

export interface AnalysisData {
  product_name?: string;
  product_category?: string;
  ingredient_labeling?: {
    ingredients_list?: string[];
  };
  recommendations?: Array<{
    priority: string;
    recommendation: string;
    regulation: string;
  }>;
  overall_assessment?: {
    primary_compliance_status?: string;
    summary?: string;
    key_findings?: string[];
  };
  compliance_table?: Array<{
    element?: string;
    section?: string;
    status: string;
    rationale?: string;
    details?: string;
    regulation?: string;
  }>;
  gras_compliance?: GRASCompliance;
  ndi_compliance?: {
    summary: {
      totalIngredients: number;
      withNDI: number;
      withoutNDI: number;
      requiresNotification: number;
    };
    results?: Array<{
      ingredient: string;
      requiresNDI: boolean;
      complianceNote: string;
    }>;
  };
  allergen_database_check?: AllergenDatabase;
}
```

### lib/export-helpers.ts

```typescript
import type { AnalysisResult, Recommendation, ComplianceTableRow } from '@/types';

interface AnalysisData {
  id: string;
  image_name: string;
  analysis_result: AnalysisResult;
  compliance_status: string;
  issues_found: number;
  created_at: string;
}
```

---

## Key Types Used

- `GRASCompliance` (from `@/types`)
- `AllergenDatabase` (from `@/types`)
- `AnalysisResult` (from `@/types`)
- `Recommendation` (from `@/types`)
- `ComplianceTableRow` (from `@/types`)

---

## Notes

- Post-processor types align with the compliance checking helpers (GRAS, NDI, allergen)
- Export helper types match the centralized `AnalysisResult` structure
- Many instances can use type inference instead of explicit `any` annotations
- This completes **Phase 1: Core Infrastructure** - all foundational files now properly typed! 🎉
