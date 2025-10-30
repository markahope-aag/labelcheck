# Production Migration Instructions

## Two-Part Migration Process

Your production database already has most tables, so we're using a **differential migration** that only adds what's missing.

Due to PostgreSQL enum limitations, this must be run in **2 parts**.

---

## Part 1: Add New Structures

**File:** `PRODUCTION_MIGRATION_PART1.sql`

**What it does:**
- Adds missing columns to `analyses` table (share_token, product_category, label_name, etc.)
- Creates new enum values (starter, professional, business)
- Creates missing tables (user_settings, allergen_database, document_category_relations)
- Adds security fixes and RLS policies

**How to run:**

1. Go to https://supabase.com/dashboard
2. Select your production project
3. Click **SQL Editor** → **New Query**
4. Open `PRODUCTION_MIGRATION_PART1.sql`
5. Copy **all contents** and paste into editor
6. Click **Run**
7. Wait for "Part 1 complete!" message

**Expected result:**
```
Part 1 complete! New enum values added. Now run PART 2 to update existing records.
```

---

## Part 2: Update Existing Data

**File:** `PRODUCTION_MIGRATION_PART2.sql`

**What it does:**
- Updates existing subscription records: basic→starter, pro→professional, enterprise→business
- Updates organization plan tiers
- Sets new defaults
- Verifies all changes were applied

**How to run:**

1. In the **same SQL Editor** (or a new query)
2. Open `PRODUCTION_MIGRATION_PART2.sql`
3. Copy **all contents** and paste into editor
4. Click **Run**
5. Check the success messages

**Expected result:**
```
✅ SUCCESS: All critical columns present
✅ Subscriptions with new plan tiers: [number]
✅ Organizations with new plan tiers: [number]
✅ Migration complete!
```

---

## What If I Get Errors?

### "column already exists"
This is fine - the migration uses `IF NOT EXISTS` checks. It will skip columns that are already there.

### "policy already exists"
This is fine - the migration checks for existing policies before creating them.

### "enum value already exists"
This is fine - the migration checks before adding enum values.

### Any other error
Copy the error message and we can troubleshoot it.

---

## After Migration Complete

Once both parts run successfully:

1. ✅ All missing columns added
2. ✅ Plan tiers updated to new naming
3. ✅ New tables created
4. ✅ Database is production-ready

**Next steps:**
- Test the deployment (sign up, analyze label, view pricing)
- Import regulatory data (optional - GRAS/NDI/allergen databases)
- Update webhooks in Clerk and Stripe

---

## Quick Verification Query

After running both parts, you can verify everything worked:

```sql
-- Check analyses table has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'analyses'
  AND column_name IN ('label_name', 'product_category', 'share_token', 'category_rationale')
ORDER BY column_name;

-- Should return 4 rows

-- Check plan tier enum values
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'plan_tier_type'::regtype
ORDER BY enumlabel;

-- Should include: basic, business, enterprise, pro, professional, starter

-- Check subscriptions updated
SELECT plan_tier, COUNT(*)
FROM subscriptions
GROUP BY plan_tier;

-- Should show new plan names (starter, professional, business) if you have any subscriptions
```
