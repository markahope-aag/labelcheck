# Batch 1: Session Helpers Migration Guide

**File:** `lib/session-helpers.ts`
**Instances:** 14
**Time Estimate:** 25 minutes
**Priority:** CRITICAL - Core infrastructure used throughout the app

---

## Import Additions

Add these imports at the top of the file (after existing imports on line 2):

```typescript
import type { AnalysisSession, AnalysisIteration, SessionStatus, IterationType } from './supabase';
import type { AnalysisResult, Recommendation } from '@/types';
import type { PostgrestError } from '@supabase/supabase-js';
```

---

## Fix 1: Line 11 - createSession Return Type

```typescript
// BEFORE
): Promise<{ data: AnalysisSession | null; error: any }> {

// AFTER
): Promise<{ data: AnalysisSession | null; error: PostgrestError | null }> {
```

**Pattern:** Supabase queries return `PostgrestError | null` for errors

---

## Fix 2: Line 36 - getSessionWithIterations Return Type

```typescript
// BEFORE
  error: any;

// AFTER
  error: PostgrestError | null;
```

---

## Fix 3: Line 72 - getUserSessions Return Type

```typescript
// BEFORE
): Promise<{ data: AnalysisSession[]; error: any }> {

// AFTER
): Promise<{ data: AnalysisSession[]; error: PostgrestError | null }> {
```

---

## Fix 4: Line 96 - addIteration inputData Parameter

```typescript
// BEFORE
  inputData: any,

// AFTER
  inputData: {
    message?: string;
    image?: string;
    text?: string;
    category?: string;
  },
```

**Explanation:** Input data can contain different fields depending on iteration type:
- Chat: `{ message: string }`
- Image analysis: `{ image: string }`
- Text check: `{ text: string }`
- Category selection: `{ category: string }`

---

## Fix 5: Line 97 - addIteration resultData Parameter

```typescript
// BEFORE
  resultData?: any,

// AFTER
  resultData?: AnalysisResult | { response: string } | null,
```

**Explanation:** Result data is either:
- Full analysis result (`AnalysisResult`) for image/text analysis
- Chat response (`{ response: string }`) for chat iterations
- `null` for pending/failed iterations

---

## Fix 6: Line 101 - addIteration Return Type

```typescript
// BEFORE
): Promise<{ data: AnalysisIteration | null; error: any }> {

// AFTER
): Promise<{ data: AnalysisIteration | null; error: PostgrestError | null }> {
```

---

## Fix 7: Line 135 - updateSessionStatus Return Type

```typescript
// BEFORE
): Promise<{ error: any }> {

// AFTER
): Promise<{ error: PostgrestError | null }> {
```

---

## Fix 8: Line 150 - updateSessionTitle Return Type

```typescript
// BEFORE
): Promise<{ error: any }> {

// AFTER
): Promise<{ error: PostgrestError | null }> {
```

---

## Fix 9: Line 164 - getLatestIteration Return Type

```typescript
// BEFORE
): Promise<{ data: AnalysisIteration | null; error: any }> {

// AFTER
): Promise<{ data: AnalysisIteration | null; error: PostgrestError | null }> {
```

---

## Fix 10: Line 185 - getIterationsByType Return Type

```typescript
// BEFORE
): Promise<{ data: AnalysisIteration[]; error: any }> {

// AFTER
): Promise<{ data: AnalysisIteration[]; error: PostgrestError | null }> {
```

---

## Fix 11: Line 241 - countIssuesInResult Parameter

```typescript
// BEFORE
function countIssuesInResult(result: any): number {

// AFTER
function countIssuesInResult(result: AnalysisResult | { response: string } | null): number {
```

**Note:** This function needs a type guard since result could be chat response or analysis

---

## Fix 12: Line 242 - Add Type Guard

```typescript
// BEFORE
function countIssuesInResult(result: any): number {
  if (!result) return 0;

  let issueCount = 0;

// AFTER
function countIssuesInResult(result: AnalysisResult | { response: string } | null): number {
  if (!result) return 0;

  // Type guard: Chat responses don't have issues to count
  if ('response' in result) return 0;

  let issueCount = 0;
```

**Explanation:** Chat responses have `{ response: string }`, not analysis data with issues

---

## Fix 13: Line 249 - Recommendation Filter

```typescript
// BEFORE
      (rec: any) => rec.priority === 'critical' || rec.priority === 'high'

// AFTER
      (rec: Recommendation) => rec.priority === 'critical' || rec.priority === 'high'
```

---

## Fix 14: Line 254 - checkCompliance Parameter

```typescript
// BEFORE
  const checkCompliance = (item: any) => {

// AFTER
  const checkCompliance = (item: unknown) => {
```

**Explanation:** `item` comes from `Object.values()` which could be any labeling section type. Use `unknown` since we're checking properties dynamically.

---

## Fix 15: Line 284 - deleteSession Return Type

```typescript
// BEFORE
): Promise<{ error: any }> {

// AFTER
): Promise<{ error: PostgrestError | null }> {
```

---

## Complete Updated Function Signatures

For quick reference, here are all the final function signatures:

```typescript
export async function createSession(
  userId: string,
  title?: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisSession | null; error: PostgrestError | null }>

export async function getSessionWithIterations(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{
  session: AnalysisSession | null;
  iterations: AnalysisIteration[];
  error: PostgrestError | null;
}>

export async function getUserSessions(
  userId: string,
  status?: SessionStatus,
  useAdmin: boolean = false
): Promise<{ data: AnalysisSession[]; error: PostgrestError | null }>

export async function addIteration(
  sessionId: string,
  iterationType: IterationType,
  inputData: {
    message?: string;
    image?: string;
    text?: string;
    category?: string;
  },
  resultData?: AnalysisResult | { response: string } | null,
  analysisId?: string,
  parentIterationId?: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration | null; error: PostgrestError | null }>

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  useAdmin: boolean = false
): Promise<{ error: PostgrestError | null }>

export async function updateSessionTitle(
  sessionId: string,
  title: string,
  useAdmin: boolean = false
): Promise<{ error: PostgrestError | null }>

export async function getLatestIteration(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration | null; error: PostgrestError | null }>

export async function getIterationsByType(
  sessionId: string,
  iterationType: IterationType,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration[]; error: PostgrestError | null }>

function countIssuesInResult(result: AnalysisResult | { response: string } | null): number

export async function deleteSession(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{ error: PostgrestError | null }>
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

**Total Changes:** 14 instances replaced
- 8 instances: `error: any` → `error: PostgrestError | null`
- 2 instances: Function parameters (`inputData: any`, `resultData?: any`)
- 2 instances: `result: any` → `AnalysisResult | { response: string } | null` with type guard
- 2 instances: Recommendation/compliance item types

**Key Types Used:**
- `PostgrestError` (from `@supabase/supabase-js`)
- `AnalysisResult` (from `@/types`)
- `Recommendation` (from `@/types`)
- `AnalysisSession`, `AnalysisIteration` (already imported)

**Pattern Established:** All Supabase helper functions now have proper error types instead of `any`
