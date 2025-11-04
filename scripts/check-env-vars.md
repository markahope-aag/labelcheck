# Environment Variables Checklist

## Bundle Purchase Variables (Required)
- [ ] `STRIPE_PRICE_ID_BUNDLE_10` - 10 analyses bundle ($52.50)
- [ ] `STRIPE_PRICE_ID_BUNDLE_25` - 25 analyses bundle ($129.00)
- [ ] `STRIPE_PRICE_ID_BUNDLE_50` - 50 analyses bundle ($259.00)

## Subscription Variables (Should already exist)
- [ ] `STRIPE_PRICE_ID_STARTER` - Starter plan monthly
- [ ] `STRIPE_PRICE_ID_PROFESSIONAL` - Professional plan monthly
- [ ] `STRIPE_PRICE_ID_BUSINESS` - Business plan monthly

## Other Stripe Variables
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

## Verification
To verify these are set correctly in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Check that all variables above are listed
4. Make sure they're set for the correct environments (Production, Preview, Development)

## Important Notes
- Variable names must match **exactly** (case-sensitive)
- Values should be Stripe Price IDs (e.g., `price_xxxxx`)
- These should be one-time payment prices (not subscription prices)
- Make sure to set them for all environments where you want bundle purchases to work

