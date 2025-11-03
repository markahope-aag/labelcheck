# Batch 8: Final UI Pages Migration Guide 🏁

**Files:** 8 UI page files
**Total Instances:** 21
**Time Estimate:** 30 minutes
**Priority:** LOW - Admin UI pages (less critical than backend)

**THIS IS THE FINAL BATCH TO 100%!** 🎉

---

## File 1: app/admin/documents/page.tsx (6 instances)

### Fix 1-5: Error Handlers (Lines 103, 130, 159, 197, 260)

All 5 error handlers follow the same pattern:

```typescript
// BEFORE
    } catch (err: any) {
      console.error('...', err);
      // ... error handling
    }

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('...', error);
      // ... error handling
    }
```

### Fix 6: Line 121 - Document Items ForEach

```typescript
// BEFORE
      data.forEach((item: any) => {

// AFTER
      data.forEach((item: RegulatoryDocument) => {
```

**Add import at top:**
```typescript
import type { RegulatoryDocument } from '@/types';
```

---

## File 2: app/team/page.tsx (5 instances)

### Import Addition
```typescript
import type { OrganizationMember } from '@/types';
```

### Fix 7: Line 142 - Members Map

```typescript
// BEFORE
      const formattedMembers = (data.members || []).map((item: any) => ({

// AFTER
      const formattedMembers = (data.members || []).map((item: OrganizationMember) => ({
```

### Fix 8-10: Error Handlers (Lines 191, 230, 285)

```typescript
// BEFORE
    } catch (error: any) {

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
```

### Fix 11: Line 412 - Select onValueChange

```typescript
// BEFORE
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>

// AFTER
                  <Select value={inviteRole} onValueChange={(value: string) => setInviteRole(value as 'admin' | 'member' | 'viewer')}>
```

---

## File 3: app/reports/page.tsx (3 instances)

### Fix 12: Line 70 - monthlyData Object

```typescript
// BEFORE
      const monthlyData: { [key: string]: any } = {};

// AFTER
      const monthlyData: { [key: string]: {
        month: string;
        totalAnalyses: number;
        compliantCount: number;
        nonCompliantCount: number;
        minorIssuesCount: number;
      } } = {};
```

### Fix 13: Line 102 - Analyses ForEach

```typescript
// BEFORE
      (analyses || []).forEach((analysis: any) => {

// AFTER
      (analyses || []).forEach((analysis) => {
```

**Explanation:** Type inference from analyses array

### Fix 14: Line 121 - Stats Map

```typescript
// BEFORE
      const statsArray: MonthlyStats[] = Object.values(monthlyData).map((m: any) => ({

// AFTER
      const statsArray: MonthlyStats[] = Object.values(monthlyData).map((m) => ({
```

**Explanation:** TypeScript can infer type from monthlyData object values

---

## File 4: app/admin/users/page.tsx (3 instances)

### Fix 15-17: Error Handlers (Lines 76, 106, 129)

```typescript
// BEFORE
    } catch (err: any) {

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
```

---

## File 5: app/admin/subscriptions/page.tsx (1 instance)

### Fix 18: Line 50 - Error Handler

```typescript
// BEFORE
    } catch (err: any) {
      console.error('Failed to load subscriptions', err);
    }

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load subscriptions', error);
    }
```

---

## File 6: app/admin/settings/page.tsx (1 instance)

### Fix 19: Line 70 - updateSetting Parameter

```typescript
// BEFORE
  const updateSetting = (section: keyof typeof settings, key: string, value: any) => {

// AFTER
  const updateSetting = (section: keyof typeof settings, key: string, value: string | number | boolean) => {
```

**Explanation:** Settings values are primitives

---

## File 7: app/admin/page.tsx (1 instance)

### Fix 20: Line 35 - Error Handler

```typescript
// BEFORE
    } catch (err: any) {
      console.error('Failed to load stats', err);
    }

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to load stats', error);
    }
```

---

## File 8: app/pricing/page.tsx (1 instance)

### Fix 21: Line 96 - Error Handler

```typescript
// BEFORE
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Failed to create checkout session. Please try again.');
    }

// AFTER
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Checkout error:', error);
      alert('Failed to create checkout session. Please try again.');
    }
```

---

## Summary of Changes

### By Type:
- **15 error handlers** → Type guard pattern (`err: unknown`)
- **3 data maps/loops** → Proper types or type inference
- **2 function parameters** → Specific primitive types
- **1 object type** → Detailed structure instead of `any`

### By File:
1. ✅ app/admin/documents/page.tsx (6)
2. ✅ app/team/page.tsx (5)
3. ✅ app/reports/page.tsx (3)
4. ✅ app/admin/users/page.tsx (3)
5. ✅ app/admin/subscriptions/page.tsx (1)
6. ✅ app/admin/settings/page.tsx (1)
7. ✅ app/admin/page.tsx (1)
8. ✅ app/pricing/page.tsx (1)

---

## Required Imports

**app/admin/documents/page.tsx:**
```typescript
import type { RegulatoryDocument } from '@/types';
```

**app/team/page.tsx:**
```typescript
import type { OrganizationMember } from '@/types';
```

All other files use type inference or built-in types.

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

Then run:
```bash
npm run build
```

Should build successfully with 0 errors!

---

## 🎉 THIS IS IT! 🎉

**After this batch:**
- **146/146 instances replaced (100% complete!)**
- **0 TypeScript errors**
- **Entire codebase is type-safe!**

---

## Quick Checklist

**Admin Pages:**
- [ ] app/admin/documents/page.tsx (6)
- [ ] app/admin/users/page.tsx (3)
- [ ] app/admin/subscriptions/page.tsx (1)
- [ ] app/admin/settings/page.tsx (1)
- [ ] app/admin/page.tsx (1)

**Other Pages:**
- [ ] app/team/page.tsx (5)
- [ ] app/reports/page.tsx (3)
- [ ] app/pricing/page.tsx (1)

**Total:** 21 instances → **100% COMPLETE!** 🏁

**Time:** ~30 minutes to finish the entire migration!

You're about to eliminate the last `any` type from your codebase! 🚀
