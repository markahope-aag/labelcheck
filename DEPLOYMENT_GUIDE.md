# LabelCheck Production Deployment Guide

**Last Updated:** 2025-10-29
**Status:** Ready for production deployment
**Estimated Time:** 3-4 hours for complete setup

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Supabase Production Setup](#supabase-production-setup)
3. [Clerk Production Setup](#clerk-production-setup)
4. [Stripe Production Setup](#stripe-production-setup)
5. [Vercel Deployment](#vercel-deployment)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Post-Deployment Testing](#post-deployment-testing)
8. [Go-Live Checklist](#go-live-checklist)

---

## Pre-Deployment Checklist

Before starting deployment, ensure you have:

- [ ] **Supabase account** with production project created
- [ ] **Clerk account** with production application created
- [ ] **Stripe account** with test mode configured (will switch to live mode later)
- [ ] **Vercel account** with GitHub repository connected
- [ ] **OpenAI API key** with sufficient credits
- [ ] **Resend API key** (optional, for email notifications)
- [ ] **Legal documents** published (Privacy Policy, Terms, Disclaimer via Termly) ✅
- [ ] **Domain name** (optional, can use Vercel subdomain initially)
- [ ] **Git repository** with all latest changes committed and pushed

---

## Supabase Production Setup

### Step 1: Create Production Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in details:
   - **Name:** `labelcheck-production`
   - **Database Password:** Generate strong password (save to password manager)
   - **Region:** Choose closest to your users (e.g., `us-east-1`)
   - **Pricing Plan:** Start with Free tier (upgrade as needed)
4. Click **Create new project**
5. Wait 2-3 minutes for provisioning

### Step 2: Apply Database Migration

1. Navigate to **SQL Editor** in left sidebar
2. Click **New Query**
3. Copy and paste the product category migration:

```sql
-- Add product_category and category_rationale columns to analyses table
-- This enables category-specific regulatory compliance checking

-- Add product_category column with constraint to ensure valid values
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS product_category TEXT
  CHECK (product_category IN (
    'CONVENTIONAL_FOOD',
    'DIETARY_SUPPLEMENT',
    'ALCOHOLIC_BEVERAGE',
    'NON_ALCOHOLIC_BEVERAGE'
  ));

-- Add category_rationale column to explain classification
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS category_rationale TEXT;

-- Create index for faster filtering by product category
CREATE INDEX IF NOT EXISTS idx_analyses_product_category
  ON analyses(product_category)
  WHERE product_category IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN analyses.product_category IS
  'Regulatory product category: CONVENTIONAL_FOOD | DIETARY_SUPPLEMENT | ALCOHOLIC_BEVERAGE | NON_ALCOHOLIC_BEVERAGE. Determines which regulatory framework applies to the label analysis.';

COMMENT ON COLUMN analyses.category_rationale IS
  'Explanation of why the product was classified into its product_category, citing specific label elements observed.';
```

4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Verify success: Should see "Success. No rows returned"
6. Verify columns were created:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'analyses'
AND column_name IN ('product_category', 'category_rationale');
```

### Step 3: Copy Environment Variables

1. Navigate to **Project Settings** → **API**
2. Copy the following values (you'll need these later):
   - **Project URL:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon/Public Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key:** `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

### Step 4: Enable Row Level Security

RLS should already be enabled from your migrations. Verify:

1. Go to **Authentication** → **Policies**
2. Check that these tables have RLS enabled:
   - `users`
   - `subscriptions`
   - `analyses`
   - `usage_tracking`
   - `organizations`
   - `organization_members`
   - `pending_invitations`
   - `gras_ingredients`
   - `ndi_ingredients`
   - `old_dietary_ingredients`

✅ **Supabase setup complete!**

---

## Clerk Production Setup

### Step 1: Create Production Application

1. Go to https://dashboard.clerk.com
2. Click **Create Application**
3. Fill in details:
   - **Application Name:** `LabelCheck Production`
   - **Sign-in Options:** Email + Password (minimum)
   - **Optional:** Add Google, GitHub OAuth
4. Click **Create Application**

### Step 2: Configure Application Settings

#### Domain Settings
1. Navigate to **Settings** → **Domains**
2. Add your production domain (if you have one)
   - Or use Clerk's development domain for now
3. Update **Home URL:** `https://your-domain.com` (or Vercel URL)

#### User Settings
1. Navigate to **User & Authentication** → **Email, Phone, Username**
2. Configure:
   - ✅ **Email address:** Required
   - ✅ **Password:** Required
   - ⬜ **Phone number:** Optional
   - ⬜ **Username:** Optional

#### Session Settings
1. Navigate to **Sessions & Security** → **Sessions**
2. Configure:
   - **Session lifetime:** 7 days (default)
   - **Multi-session handling:** Allow multiple sessions

### Step 3: Configure Webhooks

1. Navigate to **Webhooks** in sidebar
2. Click **Add Endpoint**
3. Configure webhook:
   - **Endpoint URL:** `https://your-vercel-app.vercel.app/api/webhooks/clerk`
   - **Subscribe to events:**
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
4. Click **Create**
5. Copy **Signing Secret** → Save as `CLERK_WEBHOOK_SECRET`

### Step 4: Configure Public Metadata

For admin users, you'll need to manually add role metadata:

1. Navigate to **Users** in sidebar
2. Select a user to make admin
3. Scroll to **Public Metadata** section
4. Click **Edit**
5. Add JSON:

```json
{
  "role": "admin"
}
```

6. Save changes

### Step 5: Copy Environment Variables

1. Navigate to **API Keys** in sidebar
2. Copy the following values:
   - **Publishable Key:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret Key:** `CLERK_SECRET_KEY` (⚠️ Keep secret!)
   - **Webhook Signing Secret:** `CLERK_WEBHOOK_SECRET` (from Step 3)

✅ **Clerk setup complete!**

---

## Stripe Production Setup

### Step 1: Activate Stripe Account

If not already done:
1. Go to https://dashboard.stripe.com
2. Complete account verification (business info, tax ID, bank account)
3. **Stay in TEST mode** for initial deployment

### Step 2: Create Products and Prices

#### Create Starter Product
1. Navigate to **Products** → **Add Product**
2. Fill in details:
   - **Name:** `LabelCheck Starter`
   - **Description:** `10 label compliance analyses per month. Perfect for small brands with 3-5 SKUs.`
   - **Pricing:**
     - **Price:** `$49.00 USD`
     - **Billing period:** `Monthly`
     - **Recurring:** Yes
   - **Additional Price (Annual):**
     - **Price:** `$490.00 USD`
     - **Billing period:** `Yearly`
     - **Recurring:** Yes
3. Click **Save product**
4. Copy **Price ID** for monthly → Save as `STRIPE_PRICE_ID_STARTER`
5. Copy **Price ID** for annual → Save as `STRIPE_PRICE_ID_STARTER_ANNUAL`

#### Create Professional Product
1. Navigate to **Products** → **Add Product**
2. Fill in details:
   - **Name:** `LabelCheck Professional`
   - **Description:** `50 label compliance analyses per month. For growing brands with 10-20 SKUs.`
   - **Pricing:**
     - **Price:** `$149.00 USD`
     - **Billing period:** `Monthly`
     - **Recurring:** Yes
   - **Additional Price (Annual):**
     - **Price:** `$1,490.00 USD`
     - **Billing period:** `Yearly`
     - **Recurring:** Yes
3. Click **Save product**
4. Copy **Price ID** for monthly → Save as `STRIPE_PRICE_ID_PROFESSIONAL`
5. Copy **Price ID** for annual → Save as `STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL`

#### Create Business Product
1. Navigate to **Products** → **Add Product**
2. Fill in details:
   - **Name:** `LabelCheck Business`
   - **Description:** `200 label compliance analyses per month. For large brands with 50+ SKUs.`
   - **Pricing:**
     - **Price:** `$399.00 USD`
     - **Billing period:** `Monthly`
     - **Recurring:** Yes
   - **Additional Price (Annual):**
     - **Price:** `$3,990.00 USD`
     - **Billing period:** `Yearly`
     - **Recurring:** Yes
3. Click **Save product**
4. Copy **Price ID** for monthly → Save as `STRIPE_PRICE_ID_BUSINESS`
5. Copy **Price ID** for annual → Save as `STRIPE_PRICE_ID_BUSINESS_ANNUAL`

### Step 3: Configure Webhooks

1. Navigate to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure webhook:
   - **Endpoint URL:** `https://your-vercel-app.vercel.app/api/webhooks/stripe`
   - **Events to send:**
     - ✅ `checkout.session.completed`
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
     - ✅ `invoice.payment_succeeded`
     - ✅ `invoice.payment_failed`
4. Click **Add endpoint**
5. Click **Reveal** under **Signing secret**
6. Copy signing secret → Save as `STRIPE_WEBHOOK_SECRET`

### Step 4: Configure Checkout Settings

1. Navigate to **Settings** → **Checkout**
2. Configure:
   - **Customer emails:** Collect from customers
   - **Phone numbers:** Optional
   - **Billing address:** Required
   - **Shipping address:** Not required
3. Save changes

### Step 5: Copy Environment Variables

1. Navigate to **Developers** → **API Keys**
2. Copy the following values:
   - **Publishable Key:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret Key:** `STRIPE_SECRET_KEY` (⚠️ Keep secret!)
   - **Webhook Secret:** `STRIPE_WEBHOOK_SECRET` (from Step 3)

### Step 6: Test Mode → Live Mode Switch (Later)

**⚠️ DO NOT switch to live mode yet!**

When ready to accept real payments:
1. Complete Stripe account verification
2. Switch toggle from **Test mode** to **Live mode**
3. Repeat Steps 2-5 to create live products/webhooks
4. Update environment variables in Vercel with **live keys**

✅ **Stripe setup complete! (Test mode)**

---

## Vercel Deployment

### Step 1: Connect GitHub Repository

1. Go to https://vercel.com/dashboard
2. Click **Add New...** → **Project**
3. Import your GitHub repository:
   - Search for `labelcheck` (or your repo name)
   - Click **Import**

### Step 2: Configure Build Settings

Vercel should auto-detect Next.js settings:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

If not auto-detected, set these manually.

### Step 3: Add Environment Variables

Click **Environment Variables** and add all variables from the [Environment Variables Reference](#environment-variables-reference) section below.

**⚠️ Important:** Add variables for **all environments**:
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 4: Deploy

1. Click **Deploy**
2. Wait 3-5 minutes for build to complete
3. Once deployed, copy the production URL: `https://your-app.vercel.app`

### Step 5: Update Webhook URLs

Now that you have the Vercel production URL, update webhooks:

#### Update Clerk Webhook
1. Go to Clerk Dashboard → **Webhooks**
2. Edit webhook endpoint
3. Update URL to: `https://your-app.vercel.app/api/webhooks/clerk`
4. Save changes

#### Update Stripe Webhook
1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Edit webhook endpoint
3. Update URL to: `https://your-app.vercel.app/api/webhooks/stripe`
4. Save changes

### Step 6: Custom Domain (Optional)

If you have a custom domain:

1. In Vercel, go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain: `app.yourdomain.com`
4. Follow DNS configuration instructions
5. Update Clerk **Home URL** to your custom domain

✅ **Vercel deployment complete!**

---

## Environment Variables Reference

### Required Environment Variables

```bash
# ============================================
# CLERK AUTHENTICATION
# ============================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx  # From Clerk Dashboard → API Keys
CLERK_SECRET_KEY=sk_test_xxxxx                    # From Clerk Dashboard → API Keys (SECRET)
CLERK_WEBHOOK_SECRET=whsec_xxxxx                  # From Clerk Dashboard → Webhooks (SECRET)

# ============================================
# OPENAI (GPT-4o for analysis)
# ============================================
OPENAI_API_KEY=sk-xxxxx                           # From OpenAI Platform → API Keys (SECRET)

# ============================================
# STRIPE PAYMENTS
# ============================================
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx  # From Stripe Dashboard → API Keys
STRIPE_SECRET_KEY=sk_test_xxxxx                    # From Stripe Dashboard → API Keys (SECRET)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx                  # From Stripe Dashboard → Webhooks (SECRET)

# Pricing - Starter Plan
STRIPE_PRICE_ID_STARTER=price_xxxxx                     # Monthly price ID
STRIPE_PRICE_ID_STARTER_ANNUAL=price_xxxxx              # Annual price ID

# Pricing - Professional Plan
STRIPE_PRICE_ID_PROFESSIONAL=price_xxxxx                # Monthly price ID
STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL=price_xxxxx         # Annual price ID

# Pricing - Business Plan
STRIPE_PRICE_ID_BUSINESS=price_xxxxx                    # Monthly price ID
STRIPE_PRICE_ID_BUSINESS_ANNUAL=price_xxxxx             # Annual price ID

# ============================================
# SUPABASE DATABASE
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co      # From Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx                  # From Supabase → Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx                      # From Supabase → Project Settings → API (SECRET)

# ============================================
# EMAIL NOTIFICATIONS (Optional)
# ============================================
RESEND_API_KEY=re_xxxxx                          # From Resend Dashboard → API Keys (OPTIONAL)

# ============================================
# APP CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app  # Your Vercel production URL
```

### Variable Types Reference

| Prefix | Visibility | Usage |
|--------|-----------|-------|
| `NEXT_PUBLIC_*` | **Public** (exposed to browser) | Client-side code, can be seen by users |
| No prefix | **Private** (server-only) | API routes, never exposed to browser |

### Security Best Practices

- ✅ **Never commit `.env` files to git** (already in `.gitignore`)
- ✅ **Use different keys for test vs. live mode**
- ✅ **Rotate secrets if accidentally exposed**
- ✅ **Store secrets in password manager** (1Password, LastPass, etc.)
- ✅ **Use Vercel environment variable encryption** (automatic)

---

## Post-Deployment Testing

After deployment, test all critical flows:

### Test 1: User Authentication
1. Go to your production URL
2. Click **Sign Up**
3. Create test account with real email
4. Verify email confirmation works
5. Check Supabase → `users` table to verify user was created via webhook

### Test 2: Image Upload & Analysis
1. Log into test account
2. Go to **Analyze** page
3. Upload a sample label image
4. Verify:
   - ✅ Image quality check displays
   - ✅ Category selector appears (if ambiguous)
   - ✅ Analysis completes in < 2 minutes
   - ✅ Results display all 6 compliance sections
   - ✅ GRAS compliance shows for food products
   - ✅ NDI compliance shows for supplements
   - ✅ Allergen compliance shows properly
5. Check Supabase → `analyses` table to verify record was created

### Test 3: Usage Tracking
1. Perform 2 analyses
2. Go to **Dashboard** page
3. Verify usage counter shows "2 / 10 analyses used"
4. Check Supabase → `usage_tracking` table to verify record exists

### Test 4: Stripe Checkout (Test Mode)
1. Go to **Pricing** page
2. Click **Start Starter Plan**
3. Fill in Stripe checkout with test card: `4242 4242 4242 4242`
   - Any future expiration date
   - Any 3-digit CVC
   - Any billing address
4. Complete checkout
5. Verify:
   - ✅ Redirected to success page
   - ✅ Subscription created in Stripe Dashboard
   - ✅ Supabase → `subscriptions` table updated
   - ✅ Usage limits updated to 10 analyses

### Test 5: Webhook Endpoints
1. Go to Clerk Dashboard → **Webhooks**
2. Click on webhook endpoint
3. Check **Recent Attempts** → Should see successful deliveries (200 status)
4. Go to Stripe Dashboard → **Developers** → **Webhooks**
5. Click on webhook endpoint
6. Check **Recent Events** → Should see successful deliveries

### Test 6: Analysis History
1. Perform 3-4 analyses
2. Go to **History** page
3. Verify:
   - ✅ All analyses listed
   - ✅ Search works
   - ✅ Filtering by status works
   - ✅ Clicking analysis opens detail page

### Test 7: Analysis Export
1. Open any analysis detail page
2. Click **Export** → **Download PDF**
3. Verify PDF downloads with full compliance report
4. Check Supabase → `analysis_exports` table to verify export tracked

### Test 8: Share Functionality
1. Open any analysis detail page
2. Click **Share** button
3. Copy share URL
4. Open share URL in **incognito/private window** (to test public access)
5. Verify analysis displays without requiring login

### Test 9: Admin Panel (If Admin Role Configured)
1. Add admin role to test user in Clerk (see Clerk Step 4)
2. Navigate to `/admin`
3. Verify:
   - ✅ Dashboard loads with user stats
   - ✅ Users page shows all users
   - ✅ Subscriptions page shows all subscriptions
   - ✅ Documents page allows CRUD operations

### Test 10: Email Notifications (If Resend Configured)
1. Complete an analysis
2. Check email inbox for analysis complete notification
3. Verify email formatting and content

---

## Go-Live Checklist

### Pre-Launch (Do This First)

- [ ] All environment variables configured in Vercel
- [ ] Database migration applied to production Supabase
- [ ] Webhooks configured and tested (Clerk + Stripe)
- [ ] All 10 post-deployment tests passed
- [ ] Legal documents accessible (Privacy, Terms, Disclaimer)
- [ ] Custom domain configured (optional)
- [ ] Error monitoring setup (Vercel automatically tracks errors)

### Launch Day

- [ ] Switch Stripe from **Test Mode** to **Live Mode**
  - [ ] Create live products and prices
  - [ ] Create live webhook endpoint
  - [ ] Update environment variables with live Stripe keys
  - [ ] Redeploy Vercel to pick up new env vars
- [ ] Test checkout with real credit card (small test purchase)
- [ ] Monitor Vercel logs for errors
- [ ] Monitor Stripe Dashboard for successful payments
- [ ] Monitor Supabase for database performance

### Post-Launch Monitoring (First 24 Hours)

- [ ] Check Vercel Analytics for traffic
- [ ] Monitor Stripe Dashboard for subscriptions
- [ ] Monitor OpenAI usage for API costs
- [ ] Check error logs in Vercel
- [ ] Monitor Supabase database size
- [ ] Test core flows every 4-6 hours

### Post-Launch Monitoring (First Week)

- [ ] Review user feedback
- [ ] Monitor conversion rate (trial → paid)
- [ ] Check average analyses per user
- [ ] Review error rates and fix bugs
- [ ] Monitor API costs (OpenAI)
- [ ] Check support requests

---

## Rollback Plan

If critical issues occur after deployment:

### Immediate Actions
1. Check Vercel **Deployments** page
2. Click **⋯** menu on last working deployment
3. Click **Promote to Production**
4. Deployment rolls back in 30-60 seconds

### Investigation
1. Check Vercel **Functions** logs for error traces
2. Check Stripe Dashboard for failed webhooks
3. Check Supabase logs for database errors
4. Check Clerk logs for auth issues

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Users can't sign up | Clerk webhook failing | Check `CLERK_WEBHOOK_SECRET` in Vercel env vars |
| Analysis fails | OpenAI API key invalid | Check `OPENAI_API_KEY` in Vercel env vars |
| Checkout doesn't work | Stripe keys incorrect | Check all `STRIPE_*` variables |
| Database errors | Supabase credentials wrong | Check all `SUPABASE_*` variables |
| Webhooks timing out | Webhook URL incorrect | Update webhook URLs to match Vercel domain |

---

## Support Contacts

### Vercel Support
- Dashboard: https://vercel.com/support
- Community: https://github.com/vercel/next.js/discussions

### Clerk Support
- Dashboard: https://dashboard.clerk.com/support
- Docs: https://clerk.com/docs

### Stripe Support
- Dashboard: https://dashboard.stripe.com/support
- Docs: https://stripe.com/docs

### Supabase Support
- Dashboard: https://supabase.com/dashboard/support
- Docs: https://supabase.com/docs

### OpenAI Support
- Dashboard: https://platform.openai.com/support
- Docs: https://platform.openai.com/docs

---

## Next Steps After Launch

1. **Monitor metrics** (see LAUNCH_READINESS.md)
2. **Gather user feedback** from first 5-10 beta users
3. **Fix critical bugs** identified in production
4. **Optimize performance** based on Vercel analytics
5. **Scale resources** as needed (upgrade Supabase/Vercel plans)
6. **Plan Phase II features** (see LAUNCH_READINESS.md § Post-Launch Roadmap)

---

**Deployment guide complete!** Follow this step-by-step and you'll have a production-ready LabelCheck deployment in 3-4 hours.
