/**
 * Image Processing Configuration
 */
export const IMAGE_CONSTRAINTS = {
  /** Maximum file size in megabytes */
  MAX_FILE_SIZE_MB: 10,
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Minimum image dimension in pixels for optimal AI analysis */
  MIN_DIMENSION_PX: 1500,
  /** JPEG quality for processed images (0-100) */
  JPEG_QUALITY: 95,
  /** Supported image formats */
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/jpg'] as const,
  /** Supported document formats */
  SUPPORTED_DOCUMENTS: ['application/pdf'] as const,
} as const;

/**
 * Text Processing Limits
 */
export const TEXT_LIMITS = {
  /** Maximum stored text content length (characters) */
  MAX_STORED_TEXT_LENGTH: 5000,
  /** Maximum label name length */
  MAX_LABEL_NAME_LENGTH: 200,
} as const;

/**
 * API Timeout Configuration
 */
export const API_TIMEOUTS = {
  /** OpenAI API request timeout (2 minutes) */
  OPENAI_REQUEST_MS: 120000,
  /** Retry delay for rate-limited requests (5 seconds) */
  RETRY_DELAY_MS: 5000,
  /** Second retry delay (10 seconds) */
  RETRY_DELAY_2_MS: 10000,
  /** Third retry delay (20 seconds) */
  RETRY_DELAY_3_MS: 20000,
} as const;

/**
 * Database Configuration
 */
export const DATABASE = {
  /** Cache duration for regulatory documents (1 hour) */
  REGULATORY_CACHE_MS: 60 * 60 * 1000,
  /** Cache duration for NDI lookups (1 hour) */
  NDI_CACHE_MS: 60 * 60 * 1000,
} as const;

/**
 * Image Enhancement Parameters
 */
export const IMAGE_ENHANCEMENT = {
  /** Sharpen sigma value */
  SHARPEN_SIGMA: 1.5,
  /** Sharpen M1 parameter */
  SHARPEN_M1: 1.0,
  /** Sharpen M2 parameter */
  SHARPEN_M2: 0.7,
  /** Sharpen X1 parameter */
  SHARPEN_X1: 3,
  /** Sharpen Y2 parameter */
  SHARPEN_Y2: 15,
  /** Linear contrast multiplier */
  CONTRAST_MULTIPLIER: 1.2,
  /** Chroma subsampling for JPEG */
  CHROMA_SUBSAMPLING: '4:4:4' as const,
} as const;

/**
 * Subscription Plan Limits and Features
 */
export const PLAN_LIMITS = {
  starter: {
    analyses: 10,
    historyMonths: 3,
    features: [
      '10 label analyses per month',
      'Full FDA compliance checking',
      'Allergen, GRAS, NDI verification',
      'Analysis history (3 months)',
      'Email support',
      'Export PDF reports',
    ],
  },
  professional: {
    analyses: 50,
    historyMonths: 12,
    features: [
      '50 label analyses per month',
      'Full FDA compliance checking',
      'Allergen, GRAS, NDI verification',
      'Print-ready certification',
      'Analysis history (12 months)',
      'Priority email support',
      'Export PDF/CSV/JSON',
      'Team collaboration (coming soon)',
    ],
  },
  business: {
    analyses: 200,
    historyMonths: 999999,
    features: [
      '200 label analyses per month',
      'Full FDA compliance checking',
      'Allergen, GRAS, NDI verification',
      'Print-ready certification',
      'Unlimited analysis history',
      'Priority support with phone access',
      'Advanced export options',
      'Team collaboration',
      'Custom regulatory uploads (coming soon)',
      'API access (coming soon)',
    ],
  },
} as const;

export const PLAN_PRICES = {
  starter: {
    monthly: 49,
    annual: 490, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_STARTER,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER,
  },
  professional: {
    monthly: 149,
    annual: 1490, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
    stripePriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
  },
  business: {
    monthly: 399,
    annual: 3990, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_BUSINESS,
    stripePriceId: process.env.STRIPE_PRICE_ID_BUSINESS,
  },
} as const;
