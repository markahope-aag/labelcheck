'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BUNDLE_OPTIONS, PLAN_PRICES } from '@/lib/constants';
import { Loader2, ShoppingCart, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clientLogger } from '@/lib/client-logger';
import Link from 'next/link';

interface BundlePurchaseProps {
  currentPlan: string;
  analysesUsed: number;
  analysesLimit: number;
  bundleCredits?: number;
  isOnFreeTrial?: boolean;
}

export function BundlePurchase({
  currentPlan,
  analysesUsed,
  analysesLimit,
  bundleCredits = 0,
  isOnFreeTrial = false,
}: BundlePurchaseProps) {
  const [loadingBundle, setLoadingBundle] = useState<string | null>(null);
  const { toast } = useToast();

  const isNearLimit = analysesUsed >= analysesLimit * 0.8;
  const isAtLimit = analysesUsed >= analysesLimit;

  const handlePurchaseBundle = async (bundleSize: string) => {
    setLoadingBundle(bundleSize);

    try {
      const formData = new FormData();
      formData.append('bundleSize', bundleSize);

      const response = await fetch('/api/purchase-bundle', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create bundle purchase');
      }

      const data = await response.json();

      if (!data.url) {
        clientLogger.error('No checkout URL in response', { data, bundleSize });
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      clientLogger.error('Bundle purchase failed', { error, bundleSize });
      toast({
        title: 'Error',
        description: error.message || 'Failed to start bundle purchase. Please try again.',
        variant: 'destructive',
      });
      setLoadingBundle(null);
    }
  };

  // Calculate better value messaging
  const getBetterValueMessage = (bundleSize: string) => {
    const bundle = BUNDLE_OPTIONS.find((b) => b.size === bundleSize);
    if (!bundle) return null;

    const pricePerAnalysis = bundle.price / bundle.analyses;
    const professionalPricePerAnalysis = PLAN_PRICES.professional.monthly / 50; // $2.98

    if (pricePerAnalysis > professionalPricePerAnalysis) {
      return `Upgrade to Professional for ${bundle.analyses} analyses/month at $${professionalPricePerAnalysis.toFixed(2)} each (vs $${pricePerAnalysis.toFixed(2)} here)`;
    }
    return null;
  };

  // Show bundle purchase section if:
  // 1. User is near/at limit, OR
  // 2. User has bundle credits, OR
  // 3. User is on free trial (always show for trial users to see upgrade options)
  if (!isNearLimit && bundleCredits === 0 && !isOnFreeTrial) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">Analysis Bundles</CardTitle>
            <CardDescription>
              {bundleCredits > 0
                ? `You have ${bundleCredits} bundle ${bundleCredits === 1 ? 'credit' : 'credits'} remaining`
                : isAtLimit
                  ? "You've reached your monthly limit"
                  : 'Need extra analyses this month?'}
            </CardDescription>
          </div>
          {bundleCredits > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-300">
              {bundleCredits} Available
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAtLimit && bundleCredits === 0 && (
          <div className="mb-4 p-3 bg-white border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-900 font-medium mb-2">
              Purchase a bundle to continue analyzing, or upgrade for better value
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {BUNDLE_OPTIONS.map((bundle) => {
            const pricePerAnalysis = bundle.price / bundle.analyses;
            const betterValue = getBetterValueMessage(bundle.size);

            return (
              <div
                key={bundle.size}
                className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="mb-3">
                  <h3 className="font-semibold text-slate-900 mb-1">{bundle.analyses} Analyses</h3>
                  <p className="text-2xl font-bold text-slate-900">
                    ${bundle.price}
                    <span className="text-sm text-slate-600 font-normal"> / bundle</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ${pricePerAnalysis.toFixed(2)} per analysis
                  </p>
                </div>

                {betterValue && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                    💡 {betterValue}
                  </div>
                )}

                <Button
                  onClick={() => handlePurchaseBundle(bundle.size)}
                  disabled={loadingBundle !== null}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  size="sm"
                >
                  {loadingBundle === bundle.size ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Purchase
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600 pt-4 border-t border-orange-200">
          <TrendingUp className="h-4 w-4" />
          <p>
            For better value,{' '}
            <Link href="/pricing" className="text-blue-600 hover:text-blue-700 font-medium">
              upgrade your plan
            </Link>
            . Professional plan: $149/month for 50 analyses ($2.98 each)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
