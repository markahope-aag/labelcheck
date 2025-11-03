# Final Push to 100% - Remaining 45 Instances

**Current:** 97/146 (66%)
**Target:** 146/146 (100%)
**Remaining:** 45 instances (~4 instances discrepancy from initial estimate)

---

## Simplified Batching Strategy

Instead of original 9-batch plan, consolidate remaining work into **3 focused batches**:

### Batch 6: Helper Libraries (10 instances) ⚡ 15 minutes
**Files:**
- `lib/regulatory-documents.ts` (3)
- `lib/pdf-helpers.ts` (2)
- `lib/ndi-helpers.ts` (2)
- `lib/performance-monitor.ts` (1)
- `lib/logger.ts` (1)
- `lib/client-logger.ts` (1)

**Pattern:** Mostly error handlers + utility function parameters

---

### Batch 7: Remaining API Routes (9 instances) ⚡ 15 minutes
**Files:**
- `app/api/analyze/chat/route.ts` (1) - Likely leftover
- `app/api/analyze/text/route.ts` (1)
- `app/api/analyze/check-quality/route.ts` (1)
- `app/api/admin/stats/route.ts` (1)
- `app/api/admin/subscriptions/route.ts` (1)
- `app/api/admin/users/route.ts` (1)
- `app/api/admin/users/[id]/route.ts` (2)
- `app/api/admin/documents/route.ts` (2)
- `app/api/admin/documents/[id]/route.ts` (2)
- `app/api/admin/documents/extract-pdf/route.ts` (1)
- `app/api/admin/documents/categories/route.ts` (1)

**Pattern:** Error handlers (same as Batch 4)

---

### Batch 8: UI Pages (26 instances) ⚡ 30 minutes
**Files:**
- `app/admin/documents/page.tsx` (6)
- `app/team/page.tsx` (5)
- `app/reports/page.tsx` (3)
- `app/admin/users/page.tsx` (3)
- `app/admin/subscriptions/page.tsx` (1)
- `app/admin/settings/page.tsx` (1)
- `app/admin/page.tsx` (1)
- `app/pricing/page.tsx` (1)

**Pattern:** State declarations, event handlers, data mapping

---

## Total Time Estimate: ~60 minutes to 100%!

**Strategy:**
1. Batch 6 (helpers) - Foundation utilities
2. Batch 7 (admin APIs) - Backend admin endpoints
3. Batch 8 (UI pages) - Frontend admin pages

**All follow established patterns** - no new challenges!

---

## Let's Start with Batch 6: Helper Libraries

This is the quickest batch and follows patterns we've already established.

Ready to create the guide?
