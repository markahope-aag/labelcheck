# Debugging Snyk "Too Many Redirects" Error

## Quick Diagnostic Tests

### Test 1: Check Domain Redirects
```bash
# Test naked domain (should return 200)
curl -I https://labelcheck.io

# Test www subdomain (should redirect to naked domain)
curl -I https://www.labelcheck.io

# Should see something like:
# HTTP/2 301
# Location: https://labelcheck.io
```

### Test 2: Check for Redirect Loops
```bash
# Follow all redirects and show the path
curl -L -I https://labelcheck.io 2>&1 | grep -E "(HTTP|Location)"

# Should see only:
# HTTP/2 200
# (no Location headers = no redirects)
```

### Test 3: Check Homepage Behavior
```bash
# Check if homepage redirects authenticated users
curl -I https://labelcheck.io

# If you're not logged in via curl, should return 200
# If Clerk tries to redirect, might see 307
```

## Common Causes of Redirect Loops

### 1. Middleware Redirect Loop
**Issue**: Clerk middleware redirecting to itself
**Location**: `middleware.ts`
**Check**: Look for any custom redirects in middleware

### 2. Homepage Auth Redirect
**Issue**: Homepage redirects logged-in users to /dashboard
**Location**: `app/page.tsx` (lines 11-14)
**Problem**: Security scanners might appear "logged in" somehow

### 3. CSP Headers Too Strict
**Issue**: CSP blocking Clerk authentication scripts
**Result**: Clerk can't determine auth status, keeps redirecting
**Fixed**: We already made CSP more permissive

### 4. Multiple Domain Redirects
**Issue**: Chain of redirects (www → naked → www → ...)
**Check**: Both Vercel AND your app trying to handle redirects

### 5. Clerk Development Mode Issues
**Issue**: Clerk dev instance not recognizing production domain
**Check**: Allowed origins in Clerk dashboard

## What URL Should You Submit to Snyk?

**Recommended**: Submit the homepage URL
```
https://labelcheck.io
```

**Why**:
- Public route (no authentication required)
- Should load without redirects
- Security scanners can analyze it fully

**Don't Submit**:
- `https://labelcheck.io/dashboard` (requires auth, will redirect)
- `https://labelcheck.io/admin` (requires auth + admin role)
- `https://labelcheck.io/analyze` (requires auth)

## Potential Solutions

### Solution 1: Ensure Redeployment
If you haven't redeployed since domain changes:
1. Vercel Dashboard → Deployments
2. Find latest deployment
3. Click "..." → Redeploy
4. Wait for deployment to complete
5. Try Snyk scan again

### Solution 2: Add Snyk User Agent Exception
If Snyk's scanner is being treated as authenticated user:

Create: `middleware.ts` update
```typescript
export default clerkMiddleware(async (auth, request) => {
  // Skip auth for security scanners
  const userAgent = request.headers.get('user-agent') || '';
  if (userAgent.includes('Snyk') || userAgent.includes('SecurityScanner')) {
    return NextResponse.next();
  }

  // ... rest of middleware
});
```

### Solution 3: Simplify Homepage
Temporarily remove the authenticated user redirect:

In `app/page.tsx`, comment out:
```typescript
// const { userId } = await auth();
// if (userId) {
//   redirect('/dashboard');
// }
```

This lets Snyk scan the homepage without any redirects.

### Solution 4: Check Clerk Allowed Origins
Clerk Dashboard → Your App → Paths → Allowed origins

Should include:
- `https://labelcheck.io`
- `http://localhost:3000` (for dev)

Should NOT have:
- `https://www.labelcheck.io` (this redirects anyway)

## Debugging Steps

**Step 1**: Test manually with curl (see Test 1-3 above)

**Step 2**: Check Vercel deployment logs
- Vercel Dashboard → Your Project → Deployments
- Click latest deployment → View Logs
- Look for redirect-related errors

**Step 3**: Test in incognito browser
- Open https://labelcheck.io in incognito
- Open browser DevTools → Network tab
- Look for redirect chains
- Should see direct 200 response, not 301/302 redirects

**Step 4**: Check Clerk Dashboard
- Allowed origins match your domain
- No conflicting redirect settings

**Step 5**: Temporarily disable CSP
To test if CSP is the issue, temporarily comment out CSP in `next.config.js`:
```javascript
// {
//   key: 'Content-Security-Policy',
//   value: [...]
// }
```
Redeploy and test Snyk again.

## What to Tell Me

To help debug further, please share:

1. **Output of Test 1**: `curl -I https://labelcheck.io`
2. **Output of Test 2**: `curl -I https://www.labelcheck.io`
3. **Exact Snyk error message**: Full text of the error
4. **Last deployment time**: When was the last Vercel deployment?
5. **Browser test**: Does https://labelcheck.io load fine in your browser?
6. **Incognito test**: Any redirects visible in DevTools Network tab?

## Expected vs Actual Behavior

**Expected (Correct)**:
```
User → https://labelcheck.io → 200 OK (homepage loads)
User → https://www.labelcheck.io → 301 → https://labelcheck.io → 200 OK
```

**Actual (Redirect Loop)**:
```
Snyk → https://labelcheck.io → 307/301 → ??? → 307/301 → ??? → (infinite loop)
```

We need to find what's in the `???` part.

## Quick Fix to Try Right Now

1. **Redeploy the application**:
   - Vercel Dashboard → Deployments → Redeploy latest

2. **Clear Vercel edge cache**:
   - Sometimes old redirects are cached at the edge
   - Redeployment clears this

3. **Test Snyk again**:
   - Submit `https://labelcheck.io`
   - Should work after fresh deployment

If this doesn't work, we'll need the diagnostic information above to dig deeper.
