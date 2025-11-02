# Type Safety Migration Guide

## Overview

Replace 146 instances of `any` types with proper TypeScript types for better type safety, IDE autocomplete, and bug prevention.

## New Type System

All types are now centralized in the `/types` directory:

- **`types/analysis.ts`** - Analysis result types (AI response structure)
- **`types/database.ts`** - Supabase database table types
- **`types/api.ts`** - API request/response types
- **`types/index.ts`** - Central export (import from `@/types`)

## Import Statement

```typescript
// Import types from centralized location
import type { AnalysisResult, Analysis, User, APIResponse } from '@/types';
```

## Common Patterns & Replacements

### Pattern 1: Error Handling

**BEFORE:**
```typescript
} catch (err: any) {
  console.error('Error:', err);
}
```

**AFTER:**
```typescript
} catch (err: unknown) {
  const error = err as Error;
  logger.error('Operation failed', { error, message: error.message });
}
```

**Rule:** Use `unknown` instead of `any` for caught errors, then type-assert as needed.

---

### Pattern 2: Analysis Result State

**BEFORE:**
```typescript
const [result, setResult] = useState<any>(null);
const [analysis, setAnalysis] = useState<any>(null);
```

**AFTER:**
```typescript
import type { AnalysisResult, Analysis } from '@/types';

const [result, setResult] = useState<AnalysisResult | null>(null);
const [analysis, setAnalysis] = useState<Analysis | null>(null);
```

---

### Pattern 3: Function Parameters - Analysis Results

**BEFORE:**
```typescript
const handleAnalysisComplete = (analysisResult: any) => {
  // ...
};

const countIssues = (section: any) => {
  // ...
};
```

**AFTER:**
```typescript
import type { AnalysisResult, LabelingSection } from '@/types';

const handleAnalysisComplete = (analysisResult: AnalysisResult) => {
  // ...
};

const countIssues = (section: LabelingSection) => {
  // ...
};
```

---

### Pattern 4: Array Filtering/Mapping

**BEFORE:**
```typescript
result.recommendations.filter((r: any) => r.priority === 'critical')
result.compliance_table.map((row: any, idx: number) => ...)
iterations.flatMap((iter: any) => ...)
```

**AFTER:**
```typescript
import type { Recommendation, ComplianceTableRow, AnalysisIteration } from '@/types';

result.recommendations.filter((r: Recommendation) => r.priority === 'critical')
result.compliance_table.map((row: ComplianceTableRow, idx: number) => ...)
iterations.flatMap((iter: AnalysisIteration) => ...)
```

---

### Pattern 5: API Response Handling

**BEFORE:**
```typescript
const response = await fetch('/api/analyze');
const data = await response.json(); // type: any
```

**AFTER:**
```typescript
import type { AnalyzeImageResponse, APIError } from '@/types';

const response = await fetch('/api/analyze');
const data: AnalyzeImageResponse | APIError = await response.json();

if ('error' in data) {
  // Handle error
} else {
  // data is AnalyzeImageResponse
}
```

---

### Pattern 6: Component Props

**BEFORE:**
```typescript
interface Props {
  result: any;
  analysis: any;
  onUpdate?: (data: any) => void;
}
```

**AFTER:**
```typescript
import type { AnalysisResult, Analysis } from '@/types';

interface Props {
  result: AnalysisResult;
  analysis: Analysis;
  onUpdate?: (data: AnalysisResult) => void;
}
```

---

### Pattern 7: Database Query Results

**BEFORE:**
```typescript
const { data: user } = await supabase
  .from('users')
  .select('*')
  .single(); // type: any
```

**AFTER:**
```typescript
import type { User } from '@/types';

const { data: user } = await supabase
  .from('users')
  .select('*')
  .single(); // Still need type assertion

const typedUser = user as User | null;
```

**Note:** Supabase doesn't infer types automatically. Type assertion is necessary.

---

### Pattern 8: Iteration/Session Types

**BEFORE:**
```typescript
iterations.forEach((item: any) => {
  if (item.iteration_type === 'chat_question') {
    // ...
  }
});
```

**AFTER:**
```typescript
import type { AnalysisIteration } from '@/types';

iterations.forEach((item: AnalysisIteration) => {
  if (item.iteration_type === 'chat_question') {
    // TypeScript knows result_data structure
  }
});
```

---

### Pattern 9: Settings/Config Objects

**BEFORE:**
```typescript
const updateSetting = (section: keyof typeof settings, key: string, value: any) => {
  // ...
};
```

**AFTER:**
```typescript
const updateSetting = (
  section: keyof typeof settings,
  key: string,
  value: string | boolean | number
) => {
  // Be specific about what values are allowed
};
```

---

### Pattern 10: Webhook Event Types

**BEFORE:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json(); // type: any
  const event = body as any;
}
```

**AFTER:**
```typescript
import type { StripeWebhookEvent, ClerkWebhookEvent } from '@/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const event = body as StripeWebhookEvent; // or ClerkWebhookEvent
}
```

---

## File-by-File Migration Priority

### 🔴 HIGH PRIORITY - Components with Analysis Results (15 files)

These files handle the core analysis results and need proper typing:

```
app/analyze/page.tsx - Main analysis page state
app/analysis/[id]/page.tsx - Analysis detail page
components/AnalysisChat.tsx - Chat interface
components/TextChecker.tsx - Text analysis
components/ComplianceResults.tsx - Results display
components/RecommendationsPanel.tsx - Recommendations
components/ComplianceTable.tsx - Compliance table
components/IngredientList.tsx - Ingredient display
app/share/[token]/page.tsx - Shared analysis view
app/history/page.tsx - Analysis history
app/team/page.tsx - Team management
app/reports/page.tsx - Reports page
app/settings/page.tsx - Settings page
app/accept-invitation/page.tsx - Invitation acceptance
app/error.tsx - Error boundary
```

### 🟡 MEDIUM PRIORITY - API Routes (21 files)

API routes need proper request/response types:

```
app/api/analyze/route.ts - Main analysis endpoint
app/api/analyze/chat/route.ts - Chat endpoint
app/api/analyze/text/route.ts - Text analysis endpoint
app/api/analyze/select-category/route.ts - Category selection
app/api/analyze/check-quality/route.ts - Quality check
app/api/share/route.ts - Share link generation
app/api/create-checkout-session/route.ts - Stripe checkout
app/api/accept-invitation/route.ts - Invitation acceptance
app/api/webhooks/clerk/route.ts - Clerk webhooks
app/api/webhooks/stripe/route.ts - Stripe webhooks
app/api/organizations/route.ts - Organization CRUD
app/api/organizations/members/route.ts - Member management
app/api/organizations/invitations/[id]/route.ts - Invitation management
app/api/admin/stats/route.ts - Admin stats
app/api/admin/users/route.ts - User management
app/api/admin/users/[id]/route.ts - User details
app/api/admin/users/[id]/toggle-admin/route.ts - Admin toggle
app/api/admin/subscriptions/route.ts - Subscription management
app/api/admin/documents/route.ts - Document CRUD
app/api/admin/documents/[id]/route.ts - Document details
app/api/admin/documents/extract-pdf/route.ts - PDF extraction
app/api/admin/documents/categories/route.ts - Category management
```

### 🟢 LOW PRIORITY - Helper Functions (10 files)

Helper libraries with minimal `any` usage:

```
lib/analysis/orchestrator.ts - Analysis orchestration
lib/analysis/post-processor.ts - Post-processing
lib/export-helpers.ts - Export utilities
lib/email-templates.ts - Email generation
lib/subscription-helpers.ts - Subscription queries
lib/session-helpers.ts - Session management
lib/config.ts - Configuration
lib/performance-monitor.ts - Performance tracking
app/admin/documents/page.tsx - Admin document UI
app/admin/settings/page.tsx - Admin settings UI
app/admin/subscriptions/page.tsx - Admin subscriptions UI
app/admin/users/page.tsx - Admin users UI
app/admin/page.tsx - Admin dashboard
app/pricing/page.tsx - Pricing page
```

---

## Special Cases

### Case 1: Complex AI JSON (Keep `any` with Documentation)

Some types are too dynamic for strict typing:

```typescript
// lib/supabase.ts
export interface Analysis {
  // ...
  analysis_result: AnalysisResult; // ✅ Now properly typed!
}
```

**Action:** We've created comprehensive types for the analysis result structure.

### Case 2: JSONB Database Fields

For flexible JSONB fields, use proper types:

```typescript
// BEFORE
input_data: any;
result_data: any | null;

// AFTER
import type { AnalysisIterationInputData, AnalysisResult } from '@/types';

input_data: AnalysisIterationInputData;
result_data: AnalysisResult | { response: string } | null;
```

### Case 3: Supabase Client Type Issues

Supabase doesn't provide automatic type inference. Use type assertions:

```typescript
import type { User, Analysis } from '@/types';

const { data } = await supabase.from('users').select('*').single();
const user = data as User | null;
```

---

## Type Reference Cheatsheet

### Analysis Types
- `AnalysisResult` - Complete AI analysis response
- `AnalysisResponse` - API response (includes metadata)
- `OverallAssessment` - Overall compliance summary
- `Recommendation` - Individual recommendation
- `ComplianceTableRow` - Compliance table entry
- `GeneralLabeling` - General labeling section
- `IngredientLabeling` - Ingredient section
- `AllergenLabeling` - Allergen section
- `NutritionLabeling` - Nutrition facts section

### Database Types
- `Analysis` - Database analysis record
- `AnalysisSession` - Analysis session
- `AnalysisIteration` - Session iteration
- `User` - User record
- `Subscription` - Subscription record
- `RegulatoryDocument` - Regulatory document

### API Types
- `AnalyzeImageResponse` - Image analysis API response
- `AnalyzeTextResponse` - Text analysis API response
- `AnalyzeChatResponse` - Chat API response
- `APIError` - Error response
- `APIResponse<T>` - Generic API response

---

## Verification Steps

After migration, verify:

1. **TypeScript compiles**: `npm run typecheck`
2. **No `any` in production code**: `grep -r ": any" app/ components/ lib/ | wc -l`
3. **IDE autocomplete works**: Test in VSCode/Cursor
4. **Build succeeds**: `npm run build`

---

## Migration Workflow

1. **Import types at top of file**
   ```typescript
   import type { AnalysisResult, Recommendation, Analysis } from '@/types';
   ```

2. **Replace state declarations**
   ```typescript
   // Before: const [result, setResult] = useState<any>(null);
   const [result, setResult] = useState<AnalysisResult | null>(null);
   ```

3. **Update function parameters**
   ```typescript
   // Before: function handleData(data: any) {
   function handleData(data: AnalysisResult) {
   ```

4. **Replace array operations**
   ```typescript
   // Before: items.map((item: any) => ...)
   items.map((item: Recommendation) => ...)
   ```

5. **Update error handling**
   ```typescript
   // Before: catch (err: any) {
   catch (err: unknown) {
     const error = err as Error;
   ```

---

## Benefits After Migration

✅ **Type Safety** - Catch errors at compile time
✅ **IDE Autocomplete** - Better IntelliSense
✅ **Self-Documenting** - Code explains itself
✅ **Refactoring Safety** - TypeScript tracks changes
✅ **Onboarding** - New devs understand structure faster

---

## Example: Complete File Migration

**BEFORE (app/analyze/page.tsx):**
```typescript
const [result, setResult] = useState<any>(null);

const handleAnalysisComplete = (analysisResult: any) => {
  setResult(analysisResult);
};

const criticalCount = result?.recommendations.filter((r: any) =>
  r.priority === 'critical'
).length;
```

**AFTER:**
```typescript
import type { AnalysisResult, Recommendation } from '@/types';

const [result, setResult] = useState<AnalysisResult | null>(null);

const handleAnalysisComplete = (analysisResult: AnalysisResult) => {
  setResult(analysisResult);
};

const criticalCount = result?.recommendations.filter(
  (r: Recommendation) => r.priority === 'critical'
).length;
```

---

## Questions?

- Check types in `/types` directory
- Look at example files already migrated
- Ask Claude Code for specific patterns
