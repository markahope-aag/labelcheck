# Clerk Development vs Production Mode Configuration

## Current Status: Development Mode

You're currently using Clerk in **development mode**. This affects authentication URLs and configuration.

## Development Mode Configuration

### What's Different in Development Mode:
1. **Clerk URLs**: Uses `*.clerk.accounts.dev` instead of custom domains
2. **Local Development**: Works with `localhost:3000` automatically
3. **Production Domain**: Can still deploy to production domain (labelcheck.io) in dev mode
4. **Webhooks**: Work fine with production URLs even in dev mode

### Current Clerk Settings (Development Mode):

**Allowed Origins** (should include):
- `http://localhost:3000` (for local development)
- `https://labelcheck.io` (for production deployment)
- `https://*.vercel.app` (for preview deployments)

**Redirect URLs** (automatic in dev mode):
- Clerk handles these automatically
- No need to manually configure specific paths
- Works with both localhost and production domain

**Webhook URLs** (should use production domain):
- `https://labelcheck.io/api/webhooks/clerk`

### Current Priority: Fix Vercel Environment Variable

Since Clerk dev mode handles redirects automatically, the "Too Many Redirects" issue is likely:

**Vercel Production Environment Variable Check:**
```
NEXT_PUBLIC_APP_URL=https://labelcheck.io  ✅ CORRECT
NEXT_PUBLIC_APP_URL=https://www.labelcheck.io  ❌ WRONG (causes redirect loop)
```

**How to Check/Fix:**
1. Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find: `NEXT_PUBLIC_APP_URL`
3. Click Edit
4. Ensure value is: `https://labelcheck.io` (no www)
5. Make sure it's set for: **Production** environment
6. Click Save
7. **IMPORTANT**: Redeploy your application (Settings → Deployments → Redeploy)

## When to Switch to Production Mode

You should switch Clerk to **production mode** when:
- [ ] You're ready to accept real users
- [ ] You want to remove Clerk branding from sign-in pages
- [ ] You want to use custom domains for auth (optional)
- [ ] You're comfortable with the app being "live"

### What Changes When You Go to Production:

1. **New API Keys**: You'll get production keys (pk_live_*, sk_live_*)
2. **Stripe**: Should also switch to live mode at the same time
3. **User Data**: Development and production users are separate
4. **Webhooks**: Need to create new webhook endpoints in production instance
5. **Testing**: Use Stripe test mode in Clerk dev, Stripe live mode in Clerk prod

### Production Mode Checklist (For Later):

When you're ready to go production:
- [ ] Create production Clerk instance
- [ ] Update `.env.local` with production Clerk keys
- [ ] Update Vercel environment variables with production keys
- [ ] Recreate webhook in Clerk production instance
- [ ] Update `CLERK_WEBHOOK_SECRET` with new production secret
- [ ] Switch Stripe to live mode
- [ ] Update Stripe webhook secret
- [ ] Test end-to-end: sign-up → subscription → analysis → webhook
- [ ] Verify emails are sent correctly
- [ ] Test payment processing with real card

## Current Action Items

**To fix the Snyk redirect loop NOW:**

1. ✅ Vercel domains: Already set correctly (labelcheck.io primary, www redirects)
2. 🔍 **CHECK THIS**: Vercel env var `NEXT_PUBLIC_APP_URL`
3. ✅ Clerk: Dev mode handles this automatically
4. 🔍 **CHECK THIS**: Stripe webhook URL (if using production Stripe)

**Test Commands:**
```bash
# Should redirect to labelcheck.io (301)
curl -I https://www.labelcheck.io

# Should return 200 OK
curl -I https://labelcheck.io

# Should show your correct domain
curl https://labelcheck.io | grep "NEXT_PUBLIC_APP_URL"
```

## Notes

- Development mode is **perfectly fine** for production deployment
- Many successful apps run in Clerk dev mode for months
- Only switch to production when you're ready for that commitment
- The redirect loop is NOT caused by Clerk dev mode
- Focus on fixing the Vercel environment variable first
