# Bundle Purchase Environment Variables

## Required Variables for Bundle Purchases

Add these to your local `.env` file and Vercel environment variables:

```bash
# Bundle Purchase Prices (One-time payments)
STRIPE_PRICE_ID_BUNDLE_10=price_xxxxx  # 10 analyses bundle ($52.50)
STRIPE_PRICE_ID_BUNDLE_25=price_xxxxx  # 25 analyses bundle ($129.00)
STRIPE_PRICE_ID_BUNDLE_50=price_xxxxx  # 50 analyses bundle ($259.00)
```

## Variable Names (Must Match Exactly)

- `STRIPE_PRICE_ID_BUNDLE_10` - for small bundle (10 analyses)
- `STRIPE_PRICE_ID_BUNDLE_25` - for medium bundle (25 analyses)
- `STRIPE_PRICE_ID_BUNDLE_50` - for large bundle (50 analyses)

## Important Notes

1. **Case-sensitive**: Variable names must match exactly (all uppercase)
2. **One-time payments**: These should be Stripe Price IDs for one-time payments, NOT subscriptions
3. **Price IDs format**: Should start with `price_` (e.g., `price_1abc123...`)
4. **Local development**: Restart your dev server after adding to `.env` file
5. **Vercel deployment**: Add these to Vercel → Settings → Environment Variables for Production/Preview/Development

## Testing Locally

After adding to `.env`:
1. Restart your Next.js dev server (`npm run dev`)
2. Navigate to the billing page
3. Check that bundle purchase options appear
4. Try clicking "Purchase" on a bundle (will redirect to Stripe checkout)

## Verification

The code will throw a `ConfigurationError` if these variables are missing when trying to purchase a bundle.

