# Domain Configuration Verification Checklist

After switching from www.labelcheck.io to labelcheck.io as primary domain, verify all configurations are consistent.

## ✅ Vercel Configuration

### 1. Domain Settings
- [ ] **Primary Domain**: `labelcheck.io` is set as production domain
- [ ] **Redirect**: `www.labelcheck.io` → `labelcheck.io` (301 permanent redirect)
- [ ] Verify in: Vercel Dashboard → Your Project → Settings → Domains

### 2. Environment Variables
- [ ] **NEXT_PUBLIC_APP_URL**: `https://labelcheck.io` (NO www)
- [ ] Verify in: Vercel Dashboard → Your Project → Settings → Environment Variables
- [ ] **Important**: Update for all environments (Production, Preview, Development)
- [ ] After updating, redeploy the application

## ✅ Clerk Authentication

### 1. Allowed Origins & Redirect URLs
- [ ] Sign-in redirect: `https://labelcheck.io/dashboard`
- [ ] Sign-up redirect: `https://labelcheck.io/dashboard`
- [ ] Sign-out redirect: `https://labelcheck.io`
- [ ] Allowed origins: `https://labelcheck.io`
- [ ] Verify in: Clerk Dashboard → Your App → Paths → Component paths
- [ ] Verify in: Clerk Dashboard → Your App → Paths → Authentication URLs

### 2. Webhook Endpoints
- [ ] Clerk webhook URL: `https://labelcheck.io/api/webhooks/clerk`
- [ ] Verify in: Clerk Dashboard → Your App → Webhooks → Your Webhook → Endpoint URL

## ✅ Stripe Payments

### 1. Webhook Endpoints
- [ ] Stripe webhook URL: `https://labelcheck.io/api/webhooks/stripe`
- [ ] Verify in: Stripe Dashboard → Developers → Webhooks → Your Webhook → Endpoint URL

### 2. Payment Settings
- [ ] Return URLs after checkout should use: `https://labelcheck.io`
- [ ] Cancel URLs should use: `https://labelcheck.io`
- [ ] These are set in code (`app/api/create-checkout-session/route.ts`) and will automatically use `NEXT_PUBLIC_APP_URL`

## ✅ Local Development Environment

### 1. .env.local File
- [ ] **NEXT_PUBLIC_APP_URL**: For local dev, this should be `http://localhost:3000`
- [ ] For production testing locally, temporarily change to `https://labelcheck.io`
- [ ] Location: `C:\users\markh\projects\labelcheck\.env.local`

```bash
# In .env.local (for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# When deployed to Vercel, environment variable should be:
NEXT_PUBLIC_APP_URL=https://labelcheck.io
```

## ✅ Email Service (Resend)

### 1. Sender Domain Verification
- [ ] Verify `labelcheck.io` domain in Resend
- [ ] Update DNS records (SPF, DKIM, DMARC) to point to naked domain
- [ ] Verify in: Resend Dashboard → Domains

### 2. Email Templates
- [ ] Email templates use `labelcheck.io` in links
- [ ] These are in `lib/email-templates.ts` and use `NEXT_PUBLIC_APP_URL`
- [ ] Will automatically update when environment variable is changed

## ✅ DNS Records

### 1. Verify DNS Configuration
- [ ] **A Record** for `labelcheck.io` → Points to Vercel's IP (76.76.21.21)
- [ ] **CNAME Record** for `www.labelcheck.io` → Points to `cname.vercel-dns.com`
- [ ] Check with: `nslookup labelcheck.io` and `nslookup www.labelcheck.io`

## ✅ Testing

### 1. Manual Testing
- [ ] Visit `https://labelcheck.io` - should load normally
- [ ] Visit `https://www.labelcheck.io` - should redirect to `https://labelcheck.io`
- [ ] Sign in at `https://labelcheck.io/sign-in` - should work without redirect loops
- [ ] Create checkout session - should redirect to Stripe with correct return URLs

### 2. Security Scanner Testing
- [ ] Submit `https://labelcheck.io` to Snyk - should NOT show "Too Many Redirects"
- [ ] Check browser console for CSP violations
- [ ] Verify no mixed content warnings

## ✅ After Deployment Checks

### 1. Verify Webhooks Are Working
- [ ] Test Clerk webhook: Sign up a new test user
- [ ] Check Vercel logs: Should show successful webhook received
- [ ] Test Stripe webhook: Create a test subscription
- [ ] Check Vercel logs: Should show successful payment webhook

### 2. Monitor for Issues
- [ ] Check Vercel deployment logs for errors
- [ ] Monitor Sentry/error tracking (if configured)
- [ ] Check that emails are being sent with correct domain

## 🔧 Quick Commands to Verify

```bash
# Check DNS resolution
nslookup labelcheck.io
nslookup www.labelcheck.io

# Check HTTP redirects
curl -I https://www.labelcheck.io
# Should show: Location: https://labelcheck.io

# Check that primary domain loads
curl -I https://labelcheck.io
# Should show: 200 OK
```

## 📝 Important Notes

1. **Redeploy After Changing Environment Variables**: Vercel requires a redeploy for environment variable changes to take effect
2. **Update All Environments**: Make sure Production, Preview, and Development environments all have consistent values
3. **Clear Browser Cache**: After making changes, clear browser cache or test in incognito mode
4. **Webhook Signature Verification**: Clerk and Stripe webhooks verify the endpoint URL - ensure these match exactly

## ✅ Completion

Once all items are checked:
- [ ] Redeploy application from Vercel dashboard
- [ ] Test sign-in flow end-to-end
- [ ] Test payment flow end-to-end
- [ ] Submit to Snyk security scan
- [ ] Mark this checklist as complete

---

**Date Completed**: _________________
**Verified By**: _________________
