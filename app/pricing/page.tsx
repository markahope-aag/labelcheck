'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { PLAN_LIMITS, PLAN_PRICES } from '@/lib/constants';
import { useUser } from '@clerk/nextjs';

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const { isSignedIn } = useUser();

  const plans = [
    {
      name: 'Basic',
      tier: 'basic' as const,
      description: 'Perfect for small businesses getting started',
      price: billingInterval === 'monthly' ? PLAN_PRICES.basic.monthly : PLAN_PRICES.basic.annual / 12,
      features: PLAN_LIMITS.basic.features,
      cta: 'Start Basic Plan',
      popular: false,
    },
    {
      name: 'Pro',
      tier: 'pro' as const,
      description: 'For growing companies with regular needs',
      price: billingInterval === 'monthly' ? PLAN_PRICES.pro.monthly : PLAN_PRICES.pro.annual / 12,
      features: PLAN_LIMITS.pro.features,
      cta: 'Start Pro Plan',
      popular: true,
    },
    {
      name: 'Enterprise',
      tier: 'enterprise' as const,
      description: 'For large teams with unlimited requirements',
      price: billingInterval === 'monthly' ? PLAN_PRICES.enterprise.monthly : PLAN_PRICES.enterprise.annual / 12,
      features: PLAN_LIMITS.enterprise.features,
      cta: 'Start Enterprise Plan',
      popular: false,
    },
  ];

  const handleSelectPlan = async (tier: string) => {
    if (!isSignedIn) {
      window.location.href = '/sign-up';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('plan', tier);

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1">
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Choose the plan that fits your needs. Upgrade or downgrade anytime.
              </p>

              <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingInterval === 'monthly'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('annual')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingInterval === 'annual'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Annual
                  <span className="ml-2 text-green-600 font-semibold">Save 17%</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.tier}
                  className={`relative ${
                    plan.popular ? 'border-2 border-blue-600 shadow-lg' : 'border'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="mb-6">
                      <span className="text-4xl font-bold">${Math.round(plan.price)}</span>
                      <span className="text-gray-600">/month</span>
                      {billingInterval === 'annual' && (
                        <p className="text-sm text-green-600 mt-1">
                          Billed annually
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={() => handleSelectPlan(plan.tier)}
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="mt-16 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
                  <p className="text-gray-600 text-sm">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately,
                    and we'll prorate any differences.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">What happens if I exceed my analysis limit?</h3>
                  <p className="text-gray-600 text-sm">
                    You'll be notified when you're approaching your limit. You can upgrade your plan
                    to continue analyzing labels, or wait until the next billing cycle.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                  <p className="text-gray-600 text-sm">
                    We offer a 30-day money-back guarantee. If you're not satisfied with our service,
                    contact us for a full refund.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Is my payment information secure?</h3>
                  <p className="text-gray-600 text-sm">
                    Absolutely. We use Stripe for payment processing, which is PCI-DSS compliant
                    and trusted by millions of businesses worldwide.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
