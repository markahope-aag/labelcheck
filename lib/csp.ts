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
  // In development, allow unsafe-eval for Next.js React refresh
  const isDevelopment = process.env.NODE_ENV === 'development';
  // Note: We don't use nonce in script-src because it conflicts with 'unsafe-inline'
  // Next.js and Clerk require 'unsafe-inline' for their scripts to work
  // Security is maintained through domain restrictions instead
  const scriptSrcParts = [
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    'https://challenges.cloudflare.com',
    'https://*.clerk.accounts.dev',
    'https://js.stripe.com',
    // Allow Vercel live feedback (production preview deployments)
    'https://vercel.live',
  ];

  const directives = [
    "default-src 'self'",
    // Scripts: Allow self, unsafe-inline (for Next.js), and specific trusted domains
    // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' (dev only) for hydration scripts and React refresh.
    // Note: Nonce is not used in script-src because it conflicts with 'unsafe-inline' (when nonce is present, unsafe-inline is ignored)
    `script-src ${scriptSrcParts.join(' ')}`,
    // Styles: Allow self, unsafe-inline (required for Clerk), and Google Fonts
    // Note: Clerk requires unsafe-inline for styles. Nonce is not compatible with Clerk's dynamic styles.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Workers: Allow blob and self (required for Clerk's web workers)
    "worker-src 'self' blob:",
    // Images: Allow self, data URIs, blob, and HTTPS images (needed for user uploads and external images)
    "img-src 'self' data: blob: https: https://img.clerk.com",
    // Fonts: Allow self, data URIs, and Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com",
    // Connect: API calls - specific domains only (no broad https:)
    // Added clerk-telemetry.com for Clerk's telemetry
    `connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev https://clerk.com https://clerk-telemetry.com https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://challenges.cloudflare.com`,
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
