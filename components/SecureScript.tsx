import Script from 'next/script';

/**
 * Secure wrapper for external scripts with SRI (Subresource Integrity)
 *
 * Usage:
 * <SecureScript
 *   src="https://cdn.example.com/script.js"
 *   integrity="sha384-..."
 *   strategy="afterInteractive"
 * />
 *
 * Generate SRI hash:
 * curl https://cdn.example.com/script.js | openssl dgst -sha384 -binary | openssl base64 -A
 */
interface SecureScriptProps {
  src: string;
  integrity: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
  onLoad?: () => void;
  onError?: () => void;
}

export function SecureScript({
  src,
  integrity,
  crossOrigin = 'anonymous',
  strategy = 'afterInteractive',
  onLoad,
  onError,
}: SecureScriptProps) {
  return (
    <Script
      src={src}
      integrity={integrity}
      crossOrigin={crossOrigin}
      strategy={strategy}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
