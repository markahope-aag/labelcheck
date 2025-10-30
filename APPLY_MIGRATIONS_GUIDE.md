# Production Database Migration Guide

**Purpose:** Apply all 24 database migrations to your production Supabase instance.

**Status:** Ready to run

**Estimated Time:** 5-10 minutes

---

## Quick Start (Recommended Method)

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your **production project** (xhmfycuwjknkovtojhdh)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Consolidated Migration

1. Open the file: `PRODUCTION_MIGRATION_CONSOLIDATED.sql` (in your project root)
2. Copy **all contents** of the file (Ctrl+A, Ctrl+C)
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)
5. Wait for completion (may take 1-2 minutes)

### Step 3: Verify Success

After running, you should see:
- ✅ "Success. No rows returned" (or similar success message)
- ✅ No error messages in red

To verify tables were created, run this query:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see these tables:
- users
- subscriptions
- usage_tracking
- analyses
- analysis_sessions
- analysis_iterations
- analysis_exports
- regulatory_documents
- gras_ingredients
- ndi_ingredients
- old_dietary_ingredients
- allergen_database
- organizations
- organization_members
- pending_invitations
- user_settings

---

## Important Notes

### Regulatory Data Tables (Empty After Migration)

These tables are created but will be **empty** after running the migration:
- `gras_ingredients` (1,465 ingredients)
- `ndi_ingredients` (1,253 notifications)
- `old_dietary_ingredients` (2,193 ingredients)
- `allergen_database` (9 allergens + 400+ derivatives)

**Why empty?** The migration files only create the table structure. The actual data needs to be imported separately.

**Do you need to import now?**

**NO - Not for initial testing!** The app will work without this data. The AI analysis will still function, but:
- GRAS compliance checks will show "no data available"
- NDI compliance checks will show "no data available"
- Allergen checks will show "no data available"

You can import this data later when you're ready. I can help you with the import scripts.

### Plan Tiers Migration

The migration `20251029100000_update_plan_tiers.sql` updates any existing subscription records:
- `basic` → `starter`
- `pro` → `professional`
- `enterprise` → `business`

If your database is brand new (no existing subscriptions), this does nothing and that's fine.

---

## Alternative Method: Run Migrations Individually

If the consolidated file is too large or you encounter errors, you can run migrations one at a time:

### Step 1: Run Core Schema (Required)

```sql
-- Run this first
-- File: supabase/migrations/20251016215231_create_food_label_schema.sql
```

Copy and paste the contents of each file in this order:

1. `20251016215231_create_food_label_schema.sql` - Core tables
2. `20251016225142_create_regulatory_documents.sql` - Regulatory docs table
3. `20251017020825_frosty_breeze.sql`
4. `20251017020900_twilight_summit.sql`
5. `20251017023000_shy_bread.sql`
6. `20251017024418_expand_regulatory_documents.sql`
7. `20251017024752_add_user_settings_and_teams.sql` - Organizations & teams
8. `20251021000000_add_share_token.sql` - Public sharing
9. `20251022000000_create_analysis_sessions.sql` - Iterative analysis
10. `20251022220000_create_gras_ingredients.sql` - GRAS database table
11. `20251023000000_add_product_category.sql` - Product classification
12. `20251023130000_add_category_guidance.sql` - Category guidance
13. `20251024000000_add_ndi_ingredients.sql` - NDI database table
14. `20251024010000_enable_rls_security_fixes.sql` - Row Level Security
15. `20251024020000_fix_function_search_path.sql` - Security fix
16. `20251024030000_enable_rls_remaining_tables.sql` - More RLS
17. `20251024030001_enable_rls_pending_invitations.sql` - Invitation RLS
18. `20251024030002_enable_rls_gras_ingredients.sql` - GRAS RLS
19. `20251024040000_optimize_rls_performance.sql` - Performance
20. `20251024040001_remove_duplicate_policies.sql` - Cleanup
21. `20251024050000_create_old_dietary_ingredients.sql` - ODI table
22. `20251024100000_create_allergen_database.sql` - Allergen table
23. `20251029000000_add_label_name.sql` - Label name field
24. `20251029100000_update_plan_tiers.sql` - Update plan naming

---

## Troubleshooting

### Error: "relation already exists"

**Cause:** Table already exists from a previous migration attempt.

**Solution:** Either:
1. Drop the existing table: `DROP TABLE table_name CASCADE;`
2. Or skip that specific migration (if you're running individually)

### Error: "type already exists"

**Cause:** Enum type already exists.

**Solution:** The migration likely has `IF NOT EXISTS` checks. If not, skip it.

### Error: "permission denied"

**Cause:** Using the wrong Supabase client (anon key instead of service role).

**Solution:** Make sure you're using the Supabase Dashboard SQL Editor (which has admin privileges).

### Migration runs but app still has errors

**Cause:** Environment variables in Vercel may not match database.

**Solution:**
1. Check Vercel has correct `NEXT_PUBLIC_SUPABASE_URL`
2. Redeploy Vercel after confirming env vars

---

## After Migration Complete

Once migrations are successfully applied:

1. ✅ Test sign-up/sign-in (creates user record)
2. ✅ Test uploading a label (creates analysis record)
3. ✅ Check that usage tracking works
4. ✅ Verify subscriptions can be created

The app should be fully functional at this point (except regulatory database checks will be empty until data is imported).

---

## Next Steps

After migrations are applied and verified:

1. **Test the deployment** thoroughly
2. **Import regulatory data** (optional - for GRAS/NDI/allergen checks)
3. **Update webhook URLs** in Clerk and Stripe
4. **Switch to production Clerk app** when ready for real users

---

## Need Help?

If you encounter errors during migration:
1. Copy the error message
2. Note which migration file caused the error
3. Ask for help with the specific error

Most common issues are easy to fix!
