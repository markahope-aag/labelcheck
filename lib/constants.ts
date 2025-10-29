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
      'Export PDF reports'
    ]
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
      'Team collaboration (coming soon)'
    ]
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
      'API access (coming soon)'
    ]
  }
} as const;

export const PLAN_PRICES = {
  starter: {
    monthly: 49,
    annual: 490, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_STARTER,
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER
  },
  professional: {
    monthly: 149,
    annual: 1490, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
    stripePriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL
  },
  business: {
    monthly: 399,
    annual: 3990, // 10 months pricing (2 months free)
    priceId: process.env.STRIPE_PRICE_ID_BUSINESS,
    stripePriceId: process.env.STRIPE_PRICE_ID_BUSINESS
  }
} as const;

