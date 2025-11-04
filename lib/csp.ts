/**
 * Generate a cryptographic nonce for CSP using Web Crypto API
 * Compatible with Edge Runtime
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Build a strict Content Security Policy with nonces
 * Balanced approach: Strict on sources, but allows unsafe-inline for Next.js compatibility
 *
 * Note on SRI (Subresource Integrity):
 * - Third-party scripts (Clerk, Stripe) are loaded by official React components
 * - We rely on CSP domain restrictions + HTTPS instead of SRI
 * - For manual external scripts, use the SecureScript component
 * - See docs/SRI_IMPLEMENTATION.md for details
 */
export function buildCSP(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // Scripts: Allow self, nonce, unsafe-inline (for Next.js), and specific trusted domains
    // Note: Next.js requires 'unsafe-inline' for hydration scripts. 'nonce' takes precedence in modern browsers.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://js.stripe.com https://js.stripe.com`,
    // Styles: Allow self, nonce, unsafe-inline, Google Fonts, and Clerk CDN
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com`,
    // Images: Allow self, data URIs, blob, and HTTPS images (needed for user uploads and external images)
    "img-src 'self' data: blob: https: https://img.clerk.com",
    // Fonts: Allow self, data URIs, and Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connect: API calls - specific domains only (no broad https:)
    `connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev https://clerk.com https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://challenges.cloudflare.com`,
    // Frames: Allow self and specific trusted domains only
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://js.stripe.com https://hooks.stripe.com",
    // No plugins
    "object-src 'none'",
    // Form actions: Specific domains only (no broad https:)
    "form-action 'self' https://*.clerk.accounts.dev",
    // Base URI: Restrict to self
    "base-uri 'self'",
    // Frame ancestors: Only allow same origin
    "frame-ancestors 'self'",
    // Upgrade insecure requests
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}
