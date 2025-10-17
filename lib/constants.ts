export const PLAN_LIMITS = {
  basic: {
    analyses: 10,
    historyMonths: 0,
    features: [
      '10 label analyses per month',
      'Basic compliance report',
      'Email support'
    ]
  },
  pro: {
    analyses: 50,
    historyMonths: 6,
    features: [
      '50 label analyses per month',
      'Detailed compliance reports',
      'Analysis history (6 months)',
      'Priority email support',
      'Export reports as PDF'
    ]
  },
  enterprise: {
    analyses: 999999,
    historyMonths: 999999,
    features: [
      'Unlimited analyses',
      'Advanced compliance reports',
      'Unlimited analysis history',
      'Custom regulatory document uploads',
      'Priority support with phone access',
      'API access'
    ]
  }
} as const;

export const PLAN_PRICES = {
  basic: {
    monthly: 29,
    annual: 290,
    priceId: process.env.STRIPE_PRICE_ID_BASIC,
    stripePriceId: process.env.STRIPE_PRICE_ID_BASIC
  },
  pro: {
    monthly: 79,
    annual: 790,
    priceId: process.env.STRIPE_PRICE_ID_PRO,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO
  },
  enterprise: {
    monthly: 199,
    annual: 1990,
    priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE,
    stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE
  }
} as const;

