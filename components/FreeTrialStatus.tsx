'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import { clientLogger } from '@/lib/client-logger';

interface FreeTrialStatusProps {
  analysesUsed: number;
  analysesLimit: number;
  remaining: number;
  trialDaysRemaining?: number | null;
  trialExpired?: boolean;
}

export function FreeTrialStatus({
  analysesUsed,
  analysesLimit,
  remaining,
  trialDaysRemaining,
  trialExpired,
}: FreeTrialStatusProps) {
  const { isSignedIn } = useUser();
  const { toast } = useToast();
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const percentage = Math.round((analysesUsed / analysesLimit) * 100);
  const isLow = remaining <= 3;
  const isExhausted = remaining === 0;
  const isTrialExpired =
    trialExpired ||
    (trialDaysRemaining !== null && trialDaysRemaining !== undefined && trialDaysRemaining <= 0);
  const daysRemaining = trialDaysRemaining ?? null;

  const handleUpgradeNow = async () => {
    if (!isSignedIn) {
      window.location.href = '/sign-up';
      return;
    }

    setLoadingUpgrade(true);

    try {
      // Default to Starter plan for free trial upgrade
      const formData = new FormData();
      formData.append('plan', 'starter');

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        clientLogger.error('No checkout URL in response', { data });
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      clientLogger.error('Upgrade checkout failed', { error });
      toast({
        title: 'Error',
        description: error.message || 'Failed to start upgrade process. Please try again.',
        variant: 'destructive',
      });
      setLoadingUpgrade(false);
    }
  };

  return (
    <Card
      className={`border-2 ${
        isTrialExpired
          ? 'border-red-300 bg-red-50'
          : isExhausted
            ? 'border-red-300 bg-red-50'
            : isLow
              ? 'border-orange-300 bg-orange-50'
              : 'border-blue-300 bg-blue-50'
      }`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-lg ${
              isTrialExpired || isExhausted ? 'bg-red-100' : isLow ? 'bg-orange-100' : 'bg-blue-100'
            }`}
          >
            {isTrialExpired || isExhausted ? (
              <AlertCircle className="h-6 w-6 text-red-600" />
            ) : (
              <Sparkles className="h-6 w-6 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Free Trial</h3>
                <p className="text-sm text-slate-600">
                  {isTrialExpired
                    ? 'Your 14-day free trial has expired'
                    : daysRemaining !== null
                      ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining in your trial`
                      : isExhausted
                        ? "You've used all your free analyses"
                        : isLow
                          ? `Only ${remaining} free ${remaining === 1 ? 'analysis' : 'analyses'} remaining`
                          : `${remaining} free ${remaining === 1 ? 'analysis' : 'analyses'} remaining`}
                </p>
                {daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 4 && (
                  <p className="text-xs text-orange-700 mt-1 font-medium">
                    ⏰ Only {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left!
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">
                  {analysesUsed}
                  <span className="text-sm font-normal text-slate-600">/{analysesLimit}</span>
                </p>
                <p className="text-xs text-slate-500">analyses used</p>
              </div>
            </div>

            <div className="mb-4">
              <Progress
                value={percentage}
                className={`h-3 ${
                  isExhausted
                    ? '[&>div]:bg-red-600'
                    : isLow
                      ? '[&>div]:bg-orange-600'
                      : '[&>div]:bg-blue-600'
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">{percentage}% of trial used</p>
            </div>

            {isTrialExpired ? (
              <div className="bg-white border border-red-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-red-900 font-medium mb-2">
                  Your free trial has expired - upgrade to continue analyzing labels
                </p>
                <p className="text-xs text-red-800">
                  Start with 10 analyses/month for $49, or get 50 analyses/month for $149.
                </p>
              </div>
            ) : isExhausted ? (
              <div className="bg-white border border-red-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-red-900 font-medium mb-2">
                  Upgrade to continue analyzing labels
                </p>
                <p className="text-xs text-red-800">
                  Start with 10 analyses/month for $49, or get 50 analyses/month for $149.
                </p>
              </div>
            ) : isLow ? (
              <div className="bg-white border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-orange-900 font-medium mb-2">
                  Running low on free analyses
                </p>
                <p className="text-xs text-orange-800">
                  Upgrade now to get 40+ more analyses per month and never run out.
                </p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                onClick={handleUpgradeNow}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loadingUpgrade}
              >
                {loadingUpgrade ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Upgrade Now'
                )}
              </Button>
              {!isExhausted && !isTrialExpired && (
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/analyze">Analyze Label</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
