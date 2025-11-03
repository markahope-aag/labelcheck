# Batch 2: Analysis Orchestrator Migration Guide

**File:** `lib/analysis/orchestrator.ts`
**Instances:** 10
**Time Estimate:** 30 minutes
**Priority:** HIGH - Core analysis logic, main workflow coordinator

---

## Import Additions

Add these imports at the top of the file (after existing imports around line 29):

```typescript
import type { AnalysisResult, Recommendation, RegulatoryDocument } from '@/types';
```

---

## Fix 1: Line 55 - DocumentLoadResult.regulatoryDocuments Type

```typescript
// BEFORE
export interface DocumentLoadResult {
  regulatoryDocuments: any[];
  regulatoryContext: string;
  ragInfo: {
    preClassifiedCategory: string | null;
    documentCount: number;
    totalCount: number;
  } | null;
}

// AFTER
export interface DocumentLoadResult {
  regulatoryDocuments: RegulatoryDocument[];
  regulatoryContext: string;
  ragInfo: {
    preClassifiedCategory: string | null;
    documentCount: number;
    totalCount: number;
  } | null;
}
```

**Pattern:** Regulatory documents are typed as `RegulatoryDocument[]` from centralized types

---

## Fix 2: Line 110 - getUserWithFallback Error Handler

```typescript
// BEFORE
    } catch (err: any) {
      logger.error('Exception creating user', { error: err, userId });
      throw new Error(`Failed to create user: ${err.message}`);
    }

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Exception creating user', { error, userId });
      throw new Error(`Failed to create user: ${error.message}`);
    }
```

**Pattern:** Standard error handling with type guard

---

## Fix 3: Line 385 - callAIWithRetry userMessage Type

```typescript
// BEFORE
      let userMessage: any;

// AFTER
      let userMessage:
        | OpenAI.Chat.Completions.ChatCompletionUserMessageParam
        | OpenAI.Chat.Completions.ChatCompletionMessageParam;
```

**Explanation:** OpenAI SDK has specific types for message parameters. The userMessage can be either a simple text message or a multipart message with images.

**Alternative (simpler):** If the OpenAI types are too complex, you can use:
```typescript
      let userMessage: {
        role: 'user';
        content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail: string } }>;
      };
```

---

## Fix 4: Line 426 - callAIWithRetry Error Handler

```typescript
// BEFORE
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {

// AFTER
    } catch (err: unknown) {
      // Type guard for OpenAI API errors
      const error = err as { status?: number; error?: { type?: string } };

      // Check if it's a rate limit error
      if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
```

**Explanation:** OpenAI errors have a specific structure with `status` and `error.type` properties. We use a type assertion here since OpenAI's error types aren't exported cleanly.

---

## Fix 5: Line 460 - saveAnalysis analysisData Parameter

```typescript
// BEFORE
export async function saveAnalysis(
  userInternalId: string,
  imageFile: File,
  labelName: string | null,
  analysisData: any,

// AFTER
export async function saveAnalysis(
  userInternalId: string,
  imageFile: File,
  labelName: string | null,
  analysisData: AnalysisResult,
```

---

## Fix 6: Line 465 - saveAnalysis Return Type

```typescript
// BEFORE
): Promise<any> {

// AFTER
): Promise<{
  id: string;
  user_id: string;
  image_url: string;
  image_name: string;
  label_name: string | null;
  analysis_result: AnalysisResult;
  compliance_status: string;
  issues_found: number;
  session_id: string | null;
  product_category: string | null;
  category_rationale: string | null;
  category_confidence: string | null;
  is_category_ambiguous: boolean;
  alternative_categories: string[] | null;
  created_at: string;
}> {
```

**Alternative (simpler):** Import the `Analysis` type from `@/types`:
```typescript
import type { Analysis } from '@/types';

// Then use:
): Promise<Analysis> {
```

---

## Fix 7: Line 488 - saveAnalysis Recommendation Filter

```typescript
// BEFORE
        analysisData.recommendations?.filter(
          (r: any) => r.priority === 'critical' || r.priority === 'high'
        )?.length || 0,

// AFTER
        analysisData.recommendations?.filter(
          (r: Recommendation) => r.priority === 'critical' || r.priority === 'high'
        )?.length || 0,
```

---

## Fix 8: Line 538 - saveIteration analysisData Parameter

```typescript
// BEFORE
export async function saveIteration(
  sessionId: string,
  imageFile: File,
  analysisData: any,

// AFTER
export async function saveIteration(
  sessionId: string,
  imageFile: File,
  analysisData: AnalysisResult,
```

---

## Fix 9: Line 573 - sendNotificationEmail analysisData Parameter

```typescript
// BEFORE
export async function sendNotificationEmail(
  userEmail: string,
  analysisData: any,
  analysis: any

// AFTER
export async function sendNotificationEmail(
  userEmail: string,
  analysisData: AnalysisResult,
  analysis: {
    id: string;
    compliance_status: string;
    created_at: string;
  }
```

**Alternative:** Use the `Analysis` type from `@/types` for the second parameter

---

## Fix 10: Line 584 - sendNotificationEmail Recommendation Map

```typescript
// BEFORE
        analysisData.recommendations?.map(
          (r: any) => `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],

// AFTER
        analysisData.recommendations?.map(
          (r: Recommendation) => `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],
```

---

## Complete Updated Function Signatures

For quick reference, here are all the final function signatures:

```typescript
// Import at top
import type { AnalysisResult, Recommendation, RegulatoryDocument, Analysis } from '@/types';

export interface DocumentLoadResult {
  regulatoryDocuments: RegulatoryDocument[];
  regulatoryContext: string;
  ragInfo: {
    preClassifiedCategory: string | null;
    documentCount: number;
    totalCount: number;
  } | null;
}

export async function getUserWithFallback(userId: string): Promise<UserInfo> {
  // Error handler uses: catch (err: unknown)
}

export async function callAIWithRetry(
  openai: OpenAI,
  regulatoryContext: string,
  analysisInstructions: string,
  pdfTextContent: string | undefined,
  base64Data: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  maxRetries = 3
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  // userMessage type: OpenAI.Chat.Completions.ChatCompletionUserMessageParam
  // Error handler uses: catch (err: unknown)
}

export async function saveAnalysis(
  userInternalId: string,
  imageFile: File,
  labelName: string | null,
  analysisData: AnalysisResult,
  base64Data: string | undefined,
  pdfTextContent: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  sessionId: string | null
): Promise<Analysis>

export async function saveIteration(
  sessionId: string,
  imageFile: File,
  analysisData: AnalysisResult,
  analysisId: string,
  mediaType: 'image/jpeg' | 'image/png'
): Promise<void>

export async function sendNotificationEmail(
  userEmail: string,
  analysisData: AnalysisResult,
  analysis: Analysis
): Promise<void>
```

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Summary

**Total Changes:** 10 instances replaced
- 2 instances: Error handlers (`err: any` → `err: unknown` with type guards)
- 1 instance: Regulatory documents array type
- 1 instance: OpenAI message parameter type
- 4 instances: `analysisData: any` → `analysisData: AnalysisResult`
- 2 instances: Recommendation filters/maps

**Key Types Used:**
- `RegulatoryDocument` (from `@/types`)
- `AnalysisResult` (from `@/types`)
- `Recommendation` (from `@/types`)
- `Analysis` (from `@/types`)
- `OpenAI.Chat.Completions.ChatCompletionUserMessageParam` (from OpenAI SDK)

**Pattern Established:** All analysis orchestrator functions now use proper types from the centralized type system

---

## Notes

- The `userMessage` type on line 385 uses OpenAI SDK types. If this causes issues, you can use the simpler object type alternative provided in Fix 3.
- The `analysis` return type on line 465 can use the imported `Analysis` type instead of the full inline type for cleaner code.
- Error handling follows the established pattern: `catch (err: unknown)` with type guards or type assertions as needed.
