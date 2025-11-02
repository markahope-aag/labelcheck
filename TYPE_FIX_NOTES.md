# Type System Fixes - Remaining Issues

## Summary

Type definitions have been updated to match the actual AI response structure from lib/prompts/analysis-prompt.ts.

**Progress:** Reduced from ~100 TypeScript errors to 37 errors.

**Remaining errors:** Mostly in `app/analyze/page.tsx` and `app/api/analyze/chat/route.ts` - these need code adjustments to match the correct structure.

## Key Type Structure Changes

### 1. Claims Structure (MAJOR CHANGE)

**OLD (incorrect):**
```typescript
claims?: {
  structure_function_claims?: string[];
  nutrient_content_claims?: string[];
  health_claims?: string[];
  prohibited_claims?: string[];
}
```

**NEW (correct - matches AI prompt):**
```typescript
claims: {
  structure_function_claims: {
    claims_present: boolean;
    claims_found: StructureFunctionClaim[]; // Array of claim objects
    status: ComplianceStatus;
    regulation_citation: string;
  };
  nutrient_content_claims: { /* same structure */ };
  health_claims: { /* same structure */ };
  prohibited_claims: { /* same structure */ };
  details: string;
  regulation_citation: string;
}
```

### 2. How to Access Claims

**WRONG:**
```typescript
// This won't work - structure_function_claims is an object, not an array
result.claims.structure_function_claims?.map((claim: any) => ...)
```

**CORRECT:**
```typescript
// Access the claims_found array
result.claims.structure_function_claims.claims_found.map((claim) => ...)

// Check if claims are present
if (result.claims.structure_function_claims.claims_present) {
  // Show claims
}

// Get status
const status = result.claims.structure_function_claims.status;
```

### 3. Individual Claim Types

**StructureFunctionClaim:**
```typescript
{
  claim_text: string;
  compliance_issue?: string;
  disclaimer_required?: boolean;
  disclaimer_present?: boolean;
  regulation_citation: string;
}
```

**NutrientContentClaim:**
```typescript
{
  claim_type: string;
  claim_text: string;
  nutrient: string;
  nutrient_level: string;
  required_level: string;
  meets_definition: boolean;
  issue?: string;
  regulation_citation: string;
}
```

**HealthClaim:**
```typescript
{
  claim_text: string;
  claim_type: string;
  authorized: boolean;
  issue?: string;
  regulation_citation: string;
}
```

**ProhibitedClaim:**
```typescript
{
  claim_text: string;
  violation_type: string;
  issue: string;
  regulation_citation: string;
}
```

## Specific Fixes Needed

### Fix 1: app/analyze/page.tsx - Claims Section

**Lines ~1683-1883:** All claim rendering needs to access `.claims_found` arrays

**Example Fix:**
```typescript
// BEFORE (lines 1728-1729)
{structureFunctionClaims?.map((claim: any, idx: number) => (
  claim.disclaimer_required && !claim.disclaimer_present && (

// AFTER
{result.claims.structure_function_claims.claims_found?.map((claim, idx) => (
  claim.disclaimer_required && !claim.disclaimer_present && (
```

### Fix 2: app/api/analyze/chat/route.ts - Claims Context

**Lines ~136-170:** Chat context building accesses claims incorrectly

**Example Fix:**
```typescript
// BEFORE (line 136)
if (resultData.claims.structure_function_claims && resultData.claims.structure_function_claims.length > 0) {

// AFTER
if (resultData.claims.structure_function_claims.claims_present) {
  const claims = resultData.claims.structure_function_claims.claims_found;
  if (claims.length > 0) {
    cachedContext += `- Structure/Function Claims Found: ${claims.map(c => c.claim_text).join('; ')}\n`;
  }
}
```

### Fix 3: General Labeling Property Names

**Changed:** `manufacturer_info` → `manufacturer_address`

**Fix in app/analyze/page.tsx:**
```typescript
// BEFORE
result.general_labeling.manufacturer_info

// AFTER
result.general_labeling.manufacturer_address
```

### Fix 4: Additional Requirements Structure

**Changed:** `additional_requirements` is now an object with `fortification` and `other_requirements` properties

**OLD:**
```typescript
additional_requirements?: AdditionalRequirement[] // Array
```

**NEW:**
```typescript
additional_requirements?: {
  fortification?: Fortification;
  other_requirements?: OtherRequirement[];
}
```

**Fix in app/analyze/page.tsx (~1919-1960):**
```typescript
// BEFORE
result.additional_requirements?.fortification

// AFTER
result.additional_requirements?.fortification
// (structure is already correct, but type changed from array to object)
```

## Complete Type Definitions

All types are now in:
- `types/analysis.ts` - Complete, accurate AI response structure
- `types/api.ts` - API request/response types
- `types/database.ts` - Database schema types
- `types/index.ts` - Central exports

## Verification

After fixes, run:
```bash
npm run typecheck
```

Should have 0 errors once claims access is corrected.

## Notes for Cursor

Focus on these patterns when fixing:

1. **Claims access:** Always use `.claims_found` array, not the parent object
2. **Claims presence:** Check `.claims_present` before accessing arrays
3. **Claims status:** Use `.status` property of each claim type
4. **Property names:** Use `manufacturer_address` not `manufacturer_info`
5. **Additional requirements:** Access via `.fortification` and `.other_requirements` properties

The type system is now correct - the code just needs to match it!
