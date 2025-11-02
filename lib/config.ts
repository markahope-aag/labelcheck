/**
 * Environment Configuration and Validation
 *
 * Validates required environment variables at startup to fail fast
 * if critical configuration is missing.
 */

interface RequiredEnvVars {
  // Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;

  // Database
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // AI
  OPENAI_API_KEY: string;

  // Payments
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_SECRET_KEY: string;

  // App
  NEXT_PUBLIC_APP_URL: string;
}

interface OptionalEnvVars {
  // Email (optional - some deployments may not need email)
  RESEND_API_KEY?: string;

  // Webhooks (optional for development)
  CLERK_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // PDF conversion (optional fallback)
  CLOUDCONVERT_API_KEY?: string;
}

/**
 * Validate required environment variables
 * Throws error if any required variable is missing
 */
export function validateEnv(): void {
  const requiredVars: (keyof RequiredEnvVars)[] = [
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_APP_URL',
  ];

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\n` +
        `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Warn about missing optional variables
  const optionalVars: (keyof OptionalEnvVars)[] = [
    'RESEND_API_KEY',
    'CLERK_WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRET',
    'CLOUDCONVERT_API_KEY',
  ];

  const missingOptional: string[] = [];

  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    }
  }

  if (missingOptional.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      '⚠️  Optional environment variables not set:\n' +
        missingOptional.map((v) => `  - ${v}`).join('\n')
    );
  }
}

// Auto-validate on import in server context
if (typeof window === 'undefined') {
  try {
    validateEnv();
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    // Don't throw in production to prevent crashes during builds
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
}

export const config = {
  clerk: {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
    secretKey: process.env.CLERK_SECRET_KEY!,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
  cloudconvert: {
    apiKey: process.env.CLOUDCONVERT_API_KEY,
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
  },
};
