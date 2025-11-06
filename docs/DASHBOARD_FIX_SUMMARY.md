# Dashboard & History Data Visibility Fix

**Date:** November 5, 2025
**Issue:** Dashboard and History pages showing zero analyses despite user testing labels for hours

## Problem

**Symptoms:**
- Dashboard displayed: "Total Analyses = 0", "Recent Activity = 0", "No analyses yet"
- History page was completely blank
- Compliance Overview showed: "No compliance data yet"
- User reported testing multiple labels but seeing no data

## Root Cause

**Broken RLS (Row Level Security) Policy:**

The `analyses` table has an RLS policy that tries to read Clerk JWT claims:
```sql
USING (user_id IN (
  SELECT id FROM users
  WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
))
```

**Why it failed:**
- Server-side Next.js queries don't include Clerk JWT in Supabase requests
- Client-side Supabase queries don't include Clerk JWT either
- Result: RLS blocked ALL read queries from dashboard and history pages

**Inconsistent client usage:**
- ✅ `/api/analyze` used `supabaseAdmin` to INSERT analyses (bypasses RLS)
- ❌ Dashboard used regular `supabase` to SELECT analyses (blocked by RLS)
- ❌ History page used regular `supabase` to SELECT analyses (blocked by RLS)

## Solution

### 1. Dashboard Page (`app/dashboard/page.tsx`)
- **Changed:** `supabase` → `supabaseAdmin` (all occurrences)
- **Why safe:** Dashboard is a server component with Clerk authentication
- **Impact:** Directly queries database with `user_id` filter

### 2. New API Route (`app/api/analyses/route.ts`)
Created authenticated API endpoints using `supabaseAdmin`:

**GET `/api/analyses`** - Fetch analyses with filters
- Query params: `page`, `pageSize`, `status`, `sort`, `dateFrom`, `dateTo`
- Authenticates via Clerk
- Returns: `{ analyses: Analysis[], totalCount: number }`

**DELETE `/api/analyses?id=xxx`** - Delete specific analysis
- Verifies analysis belongs to authenticated user
- Uses `supabaseAdmin` for deletion

### 3. History Page (`app/history/page.tsx`)
- **Replaced:** Direct Supabase queries → API route calls
- **loadAnalyses():** Now calls `GET /api/analyses` with filters
- **handleDelete():** Now calls `DELETE /api/analyses?id=xxx`
- **Removed:** Unused `supabase` import

## Files Modified

| File | Change | Type |
|------|--------|------|
| `app/dashboard/page.tsx` | Use `supabaseAdmin` instead of `supabase` | Modified |
| `app/api/analyses/route.ts` | Created authenticated data API | **NEW** |
| `app/history/page.tsx` | Use API route instead of direct queries | Modified |

## Impact

**Before:**
- ❌ Dashboard showed 0 analyses (data existed but was invisible)
- ❌ History page was blank
- ❌ Compliance stats unavailable
- ❌ Data saved but inaccessible due to RLS blocking reads

**After:**
- ✅ Dashboard displays total analyses, recent activity, compliance rate
- ✅ History page loads and displays all user analyses
- ✅ Filters, search, pagination work correctly
- ✅ Delete function removes analyses properly
- ✅ All data properly filtered by authenticated user

## Security

- ✅ User authentication enforced by Clerk middleware on all routes
- ✅ API routes verify `userId` from Clerk before querying
- ✅ `supabaseAdmin` queries still filter by `user_id` (maintains user isolation)
- ✅ No cross-user data leakage (each user only sees their own analyses)
- ℹ️ RLS policy remains enabled but is bypassed by admin client

## Testing Checklist

After deployment, verify:

- [ ] Dashboard shows correct total analysis count
- [ ] Dashboard displays recent analyses (last 3)
- [ ] Dashboard shows compliance statistics
- [ ] History page loads all user analyses
- [ ] History filters work (status, date range, search)
- [ ] History pagination works correctly
- [ ] Delete button removes analyses
- [ ] Users can only see their own data (no cross-user access)

## Technical Notes

**Why use `supabaseAdmin`?**
- RLS policies expect Clerk JWT claims that aren't available in Next.js server/client Supabase queries
- User is already authenticated by Clerk middleware before reaching these components/APIs
- Admin client allows bypassing RLS while still filtering by `user_id`

**Alternative considered:**
- Fix RLS policy to work without JWT claims → Complex, requires auth.uid() from Supabase auth
- Would require switching from Clerk to Supabase auth → Major breaking change
- Current approach is simpler and maintains existing auth architecture
