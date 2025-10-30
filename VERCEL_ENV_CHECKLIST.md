# Vercel Environment Variables Checklist

**Purpose:** This checklist identifies all environment variable changes needed in your Vercel deployment to make LabelCheck production-ready.

**Last Updated:** 2025-10-30

---

## Critical Issues Found

### 1. Wrong AI Provider API Key
- ❌ **Current:** `ANTHROPIC_API_KEY` (not used by the app)
- ✅ **Needed:** `OPENAI_API_KEY` (required for GPT-4o analysis)
- **Action:** Add `OPENAI_API_KEY`, remove `ANTHROPIC_API_KEY`

### 2. Missing Supabase Variables
- ❌ **Missing:** `NEXT_PUBLIC_SUPABASE_URL`
- ❌ **Missing:** `SUPABASE_SERVICE_ROLE_KEY`
- **Action:** Add both from your Supabase dashboard

### 3. Outdated Stripe Price ID Naming
- ❌ **Current:** `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ENTERPRISE`
- ✅ **Needed:** `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PROFESSIONAL`, `STRIPE_PRICE_ID_BUSINESS`
- **Action:** Rename these 3 variables (or delete old ones and add new ones)

### 4. Missing Annual Pricing Variables
- ❌ **Missing:** All annual Stripe price IDs
- ✅ **Needed:** 3 annual price IDs (one for each plan)
- **Action:** Add `STRIPE_PRICE_ID_STARTER_ANNUAL`, `STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL`, `STRIPE_PRICE_ID_BUSINESS_ANNUAL`

---

## Step-by-Step Action Plan

### Step 1: Add Missing Critical Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add

Add these new variables for **All Environments** (Production, Preview, Development):

```
Variable Name: OPENAI_API_KEY
Value: [Copy from your local .env file]
Environments: ✓ Production ✓ Preview ✓ Development

Variable Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://xhmfycuwjknkovtojhdh.supabase.co
Environments: ✓ Production ✓ Preview ✓ Development

Variable Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Copy from your local .env file]
Environments: ✓ Production ✓ Preview ✓ Development
```

### Step 2: Rename Stripe Monthly Price IDs

**Option A - Rename (Recommended):**
1. Click "Edit" on `STRIPE_PRICE_ID_BASIC` → Change name to `STRIPE_PRICE_ID_STARTER`
2. Click "Edit" on `STRIPE_PRICE_ID_PRO` → Change name to `STRIPE_PRICE_ID_PROFESSIONAL`
3. Click "Edit" on `STRIPE_PRICE_ID_ENTERPRISE` → Change name to `STRIPE_PRICE_ID_BUSINESS`

**Option B - Delete and Re-add:**
1. Delete `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ENTERPRISE`
2. Add new variables:
   - `STRIPE_PRICE_ID_STARTER` = [your Starter monthly price ID]
   - `STRIPE_PRICE_ID_PROFESSIONAL` = [your Professional monthly price ID]
   - `STRIPE_PRICE_ID_BUSINESS` = [your Business monthly price ID]

### Step 3: Add Annual Stripe Price IDs

Add these new variables for **All Environments**:

```
Variable Name: STRIPE_PRICE_ID_STARTER_ANNUAL
Value: [Get from Stripe Dashboard - Starter product annual price]
Environments: ✓ Production ✓ Preview ✓ Development

Variable Name: STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL
Value: [Get from Stripe Dashboard - Professional product annual price]
Environments: ✓ Production ✓ Preview ✓ Development

Variable Name: STRIPE_PRICE_ID_BUSINESS_ANNUAL
Value: [Get from Stripe Dashboard - Business product annual price]
Environments: ✓ Production ✓ Preview ✓ Development
```

**Note:** If you haven't created annual prices in Stripe yet, see "Step 5: Create Annual Prices in Stripe" below.

### Step 4: Remove Unused Variables

Delete this variable (not used by the application):

```
❌ ANTHROPIC_API_KEY
```

### Step 5: Create Annual Prices in Stripe (If Not Done)

If you haven't created annual pricing in Stripe yet:

1. Go to Stripe Dashboard → Products
2. For each product (Starter, Professional, Business):
   - Click the product
   - Click "Add another price"
   - Select "Recurring"
   - Billing period: "Yearly"
   - Price: [Annual amount - see pricing below]
   - Click "Add price"
   - Copy the new price ID (starts with `price_`)

**Annual Pricing:**
- Starter: $490/year (save $98 vs monthly)
- Professional: $1,490/year (save $298 vs monthly)
- Business: $3,990/year (save $798 vs monthly)

### Step 6: Verify All Variables

After making changes, verify you have all these variables in Vercel:

**Authentication (3 variables):**
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- ✅ `CLERK_SECRET_KEY`
- ✅ `CLERK_WEBHOOK_SECRET`

**AI Analysis (1 variable):**
- ✅ `OPENAI_API_KEY`

**Payments (10 variables):**
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_WEBHOOK_SECRET`
- ✅ `STRIPE_PRICE_ID_STARTER`
- ✅ `STRIPE_PRICE_ID_STARTER_ANNUAL`
- ✅ `STRIPE_PRICE_ID_PROFESSIONAL`
- ✅ `STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL`
- ✅ `STRIPE_PRICE_ID_BUSINESS`
- ✅ `STRIPE_PRICE_ID_BUSINESS_ANNUAL`

**Database (3 variables):**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

**App Configuration (1 variable):**
- ✅ `NEXT_PUBLIC_APP_URL`

**Optional (1 variable):**
- ✅ `RESEND_API_KEY` (for email notifications)

**Total: 18 required variables + 1 optional = 19 variables**

---

## Deployment After Changes

After updating environment variables in Vercel:

1. **Automatic Redeploy:** Vercel will automatically redeploy your app when you change env vars
2. **Manual Redeploy:** Or go to Deployments → Latest → "Redeploy" button
3. **Check Logs:** After deployment, check function logs for any errors
4. **Test Critical Flows:**
   - Sign up / Sign in (tests Clerk)
   - Upload and analyze a label (tests OpenAI + Supabase)
   - View subscription pricing (tests Stripe price IDs)

---

## Common Issues & Solutions

### Issue: "OpenAI API key not found"
**Solution:** Make sure `OPENAI_API_KEY` is added (not `ANTHROPIC_API_KEY`)

### Issue: "Cannot connect to database"
**Solution:** Check that both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### Issue: Stripe checkout shows "Invalid price ID"
**Solution:** Verify your Stripe price IDs match the ones in your Stripe dashboard. Price IDs start with `price_` and are unique for each environment (test mode vs live mode)

### Issue: Variables updated but app still broken
**Solution:** Environment variables are cached. Trigger a new deployment or wait 5 minutes for cache to clear

---

## Next Steps After Environment Variables Are Set

1. ✅ Update your local `.env` file to match new naming (STARTER/PROFESSIONAL/BUSINESS)
2. ✅ Commit and push code changes (plan tier fix in analyze route)
3. ✅ Apply database migrations to production Supabase
4. ✅ Test full user flow end-to-end
5. ✅ Update webhook URLs in Clerk and Stripe to point to production domain

---

## Reference: Local .env File

Your local `.env` file should also be updated to match the new naming:

```env
# OLD NAMING (Remove these)
STRIPE_PRICE_ID_BASIC=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_ENTERPRISE=

# NEW NAMING (Use these)
STRIPE_PRICE_ID_STARTER=
STRIPE_PRICE_ID_PROFESSIONAL=
STRIPE_PRICE_ID_BUSINESS=
STRIPE_PRICE_ID_STARTER_ANNUAL=
STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL=
STRIPE_PRICE_ID_BUSINESS_ANNUAL=
```

See `.env.example` for the complete reference file with comments.
