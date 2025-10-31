# Subresource Integrity (SRI) Implementation Guide

## Overview

Subresource Integrity (SRI) is a security feature that enables browsers to verify that resources fetched from CDNs haven't been tampered with.

## Current Status

**Third-Party Scripts (Limited Control):**
- ✅ **Clerk Authentication**: Uses official `@clerk/nextjs` package - scripts loaded by Clerk's React components
- ✅ **Stripe Payments**: Uses official `@stripe/stripe-js` package - scripts loaded by Stripe's React components
- ✅ **Google Fonts**: Self-hosted via `next/font` - no external CDN requests

**Why SRI isn't applied to third-party libraries:**
- Clerk and Stripe dynamically inject their own `<script>` tags
- We don't control the script tags they create
- SRI hashes would break whenever they update their services
- These libraries use their own security mechanisms (signed requests, HTTPS, CSP)

**Security Mitigations in Place:**
- ✅ Content Security Policy (CSP) restricts script sources to trusted domains only
- ✅ Strict HTTPS enforcement via HSTS
- ✅ All cookies have Secure flags
- ✅ Scripts only allowed from: `clerk.accounts.dev`, `js.stripe.com`, `challenges.cloudflare.com`

## Adding External Scripts with SRI

If you need to add a manual external script (e.g., analytics, monitoring), use the `SecureScript` component:

### 1. Generate SRI Hash

```bash
# Generate SHA-384 hash for a CDN resource
curl https://cdn.example.com/script.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### 2. Use SecureScript Component

```tsx
import { SecureScript } from '@/components/SecureScript';

export default function Page() {
  return (
    <>
      <SecureScript
        src="https://cdn.example.com/analytics.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux..."
        strategy="afterInteractive"
      />
    </>
  );
}
```

### 3. Supported Hash Algorithms

- **SHA-384** (recommended): Best balance of security and performance
- **SHA-512**: Maximum security (larger hash size)
- **SHA-256**: Minimum security (not recommended)

## CSP and SRI

Our Content Security Policy (CSP) complements SRI:

```
script-src 'self' 'nonce-XXXXX' https://specific-trusted-domains.com
```

This ensures:
1. Scripts can only load from trusted domains (CSP)
2. Scripts from those domains haven't been tampered with (SRI)
3. Inline scripts require a cryptographic nonce (CSP)

## Mozilla Observatory Score

**Expected Status**: "SRI not implemented, but all external scripts are loaded over HTTPS"

This is expected for modern React/Next.js applications that use:
- Official third-party packages (Clerk, Stripe)
- Self-hosted fonts (next/font)
- Dynamic script injection by libraries

The combination of CSP + HTTPS + Secure cookies provides strong security even without SRI on third-party library scripts.

## Future Improvements

If Mozilla Observatory adds more weight to SRI:
1. Evaluate switching to self-hosted versions of third-party libraries
2. Use edge proxies to add SRI hashes automatically
3. Implement stricter CSP with `require-sri-for script` (when browser support improves)

## References

- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [W3C SRI Specification](https://www.w3.org/TR/SRI/)
- [Next.js Script Optimization](https://nextjs.org/docs/app/api-reference/components/script)
