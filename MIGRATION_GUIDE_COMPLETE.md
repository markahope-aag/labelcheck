# Complete Type Safety Migration Plan

**Goal:** Replace all remaining 102 instances of `any` types with proper TypeScript types

**Current Progress:** 44/146 replaced (30% complete) → Target: 146/146 (100%)

**Estimated Total Time:** 2-3 hours

---

## Strategic Prioritization

This plan prioritizes files based on:
1. **Impact** - Core infrastructure used by many other files
2. **Dependencies** - Fix foundational files first
3. **Complexity** - Group similar patterns together
4. **Risk** - Critical paths (analysis, sessions) before nice-to-haves (export, email)

---

## Batch 1: Core Infrastructure (14 instances) ⚡ 25 minutes

**Why First:** Session helpers are used throughout the app. Fixing these types improves type safety everywhere.

### Files:
1. **lib/session-helpers.ts** (14 instances)
   - Return types for Supabase queries (8 instances of `error: any`)
   - Function parameters (`inputData: any`, `resultData?: any`)
   - Issue counting logic (`result: any`, `rec: any`, `item: any`)

**Impact:** HIGH - Used by analyze page, chat, text checker, history

**Patterns:**
- Supabase error types: `PostgrestError | null`
- Input data: `AnalysisIterationInputData`
- Result data: `AnalysisResult | { response: string } | null`
- Recommendation filters: `(rec: Recommendation) => ...`

---

## Batch 2: Analysis Core (10 instances) ⚡ 30 minutes

**Why Second:** Orchestrator is the heart of the analysis flow. Depends on session-helpers.

### Files:
1. **lib/analysis/orchestrator.ts** (10 instances)
   - Error handlers (2 instances: `err: any`, `error: any`)
   - Regulatory documents parameter (`regulatoryDocuments: any[]`)
   - User messages (`userMessage: any`)
   - Analysis data parameters (3 instances: `analysisData: any`, `analysis: any`)
   - Recommendation filters (2 instances: `r: any`)

**Impact:** HIGH - Main analysis logic, used by /api/analyze

**Patterns:**
- Error handling: `catch (err: unknown)`
- Regulatory docs: `RegulatoryDocument[]`
- Analysis data: `AnalysisResult`
- Recommendations: `(r: Recommendation) => ...`

---

## Batch 3: Post-Processing (9 instances) ⚡ 20 minutes

**Why Third:** Post-processor enhances analysis results, depends on core types.

### Files:
1. **lib/analysis/post-processor.ts** (6 instances)
   - GRAS compliance: `gras_compliance?: any`
   - NDI compliance: `ndi_compliance?: any`
   - Allergen check: `allergen_database_check?: any`
   - NDI results filters (2 instances: `result: any`)
   - Allergen sorting: `a: any`

2. **lib/export-helpers.ts** (6 instances)
   - Analysis result parameter: `analysis_result: any`
   - Recommendation filters (4 instances: `r: any`)
   - Compliance table map: `row: any`

**Impact:** MEDIUM - Enhancement and export features

**Patterns:**
- Compliance objects: `GRASCompliance`, `AllergenDatabase`
- Analysis result: `AnalysisResult`
- Recommendations: `(r: Recommendation) => ...`
- Compliance table: `(row: ComplianceTableRow) => ...`

---

## Batch 4: Simple API Routes (11 instances) ⚡ 20 minutes

**Why Fourth:** Quick wins with established patterns from HIGH priority work.

### Files:
1. **app/api/analyze/route.ts** (3 instances)
2. **app/api/analyze/select-category/route.ts** (1 instance)
3. **app/api/share/route.ts** (1 instance)
4. **app/api/create-checkout-session/route.ts** (3 instances)
5. **app/api/accept-invitation/route.ts** (2 instances)
6. **app/api/check-quality/route.ts** (1 instance)

**Impact:** MEDIUM - API endpoints

**Patterns:**
- Error handlers: `catch (err: unknown)`
- Stripe types: `Stripe.Checkout.Session`, `Stripe.Price`
- Request body: Defined API types from `@/types`

---

## Batch 5: Webhook Handlers (6 instances) ⚡ 20 minutes

**Why Fifth:** Critical infrastructure but isolated, clear patterns.

### Files:
1. **app/api/webhooks/clerk/route.ts** (4 instances)
2. **app/api/webhooks/stripe/route.ts** (2 instances)

**Impact:** HIGH - Critical for auth/payments, but well-tested

**Patterns:**
- Webhook events: `ClerkWebhookEvent`, `StripeWebhookEvent` (types from @/types)
- Error handling: `catch (err: unknown)`
- Event data: Clerk/Stripe SDK types

---

## Batch 6: Email & Config (4 instances) ⚡ 10 minutes

**Why Sixth:** Low complexity, nice-to-have features.

### Files:
1. **lib/email-templates.ts** (2 instances)
2. **lib/subscription-helpers.ts** (1 instance)
3. **lib/config.ts** (1 instance)

**Impact:** LOW - Non-critical utilities

**Patterns:**
- Analysis data: `AnalysisResult`
- User/subscription: `User`, `Subscription`

---

## Batch 7: Organization & Members (7 instances) ⚡ 15 minutes

**Why Seventh:** Team features, less critical than core analysis.

### Files:
1. **app/api/organizations/route.ts** (3 instances)
2. **app/api/organizations/members/route.ts** (4 instances)

**Impact:** MEDIUM - Team collaboration

**Patterns:**
- Organization types: `Organization`, `OrganizationMember`
- Error handling: `catch (err: unknown)`

---

## Batch 8: Admin API Routes (~30 instances) ⚡ 45 minutes

**Why Eighth:** Admin-only features, can be done last.

### Files:
1. **app/api/admin/stats/route.ts** (~3 instances)
2. **app/api/admin/users/route.ts** (~5 instances)
3. **app/api/admin/users/[id]/route.ts** (~3 instances)
4. **app/api/admin/subscriptions/route.ts** (~4 instances)
5. **app/api/admin/documents/route.ts** (~5 instances)
6. **app/api/admin/documents/[id]/route.ts** (~3 instances)
7. **app/api/admin/analytics/route.ts** (~7 instances)

**Impact:** LOW - Admin-only, limited usage

**Patterns:**
- Database types: `User`, `Subscription`, `RegulatoryDocument`
- Analytics: Define specific interfaces for stats
- Error handling: `catch (err: unknown)`

---

## Batch 9: Admin UI Pages (~11 instances) ⚡ 20 minutes

**Why Last:** UI pages, least critical, can tolerate some `any` types temporarily.

### Files:
1. **app/admin/page.tsx** (~2 instances)
2. **app/admin/users/page.tsx** (~2 instances)
3. **app/admin/subscriptions/page.tsx** (~2 instances)
4. **app/admin/analytics/page.tsx** (~3 instances)
5. **app/admin/documents/page.tsx** (~2 instances)

**Impact:** LOW - Admin UI, limited users

**Patterns:**
- State declarations: Proper React state types
- API responses: Types from `@/types`
- Event handlers: Proper event types

---

## Execution Plan

### Phase 1: Core (Batches 1-3) - 44 instances, ~75 minutes
**Priority:** CRITICAL - Do these first
- Session helpers (infrastructure)
- Analysis orchestrator (core logic)
- Post-processor & exports (enhancement)

**Checkpoint:** Run `npm run typecheck` - should still pass

### Phase 2: APIs (Batches 4-5) - 17 instances, ~40 minutes
**Priority:** HIGH - User-facing endpoints
- Simple API routes
- Webhook handlers

**Checkpoint:** Run `npm run typecheck` + test key user flows

### Phase 3: Utilities (Batches 6-7) - 11 instances, ~25 minutes
**Priority:** MEDIUM - Supporting features
- Email templates
- Organization management

**Checkpoint:** Run `npm run typecheck`

### Phase 4: Admin (Batches 8-9) - 41 instances, ~65 minutes
**Priority:** LOW - Admin-only features
- Admin API routes
- Admin UI pages

**Checkpoint:** Run `npm run typecheck` + `npm run build`

---

## Success Criteria

- ✅ `npm run typecheck` passes with 0 errors
- ✅ `npm run build` succeeds
- ✅ No `any` types remaining in HIGH/MEDIUM/LOW priority files
- ✅ All patterns documented in TYPE_SAFETY_MIGRATION_GUIDE.md
- ✅ TECHNICAL_DEBT.md updated to mark task complete

---

## Next Steps

1. **Start with Batch 1** - Session helpers (14 instances)
2. Read detailed guide: `MIGRATION_GUIDE_BATCH_1.md` (creating next)
3. Have Cursor apply fixes using the guide
4. Verify with `npm run typecheck`
5. Commit: "Complete Batch 1: Session helpers type safety"
6. Continue to Batch 2

---

## Quick Reference

**Total Remaining:** 102 instances across 9 batches
**Estimated Time:** 2-3 hours total
**Approach:** Batch-by-batch with verification checkpoints
**Priority Order:** Core → APIs → Utilities → Admin

**Most Common Patterns:**
1. Error handling: `catch (err: unknown)` with type guards
2. Recommendations: `(rec: Recommendation) => ...`
3. Analysis data: `AnalysisResult`
4. Supabase errors: `PostgrestError | null`
5. Compliance table: `(row: ComplianceTableRow) => ...`
