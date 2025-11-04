import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Check, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { PLAN_LIMITS, PLAN_PRICES } from '@/lib/constants';
import {
  getUserUsage,
  getSubscriptionStatus,
  getUserSubscription,
} from '@/lib/subscription-helpers';
import { FreeTrialStatus } from '@/components/FreeTrialStatus';
import { BundlePurchase } from '@/components/BundlePurchase';

export default async function BillingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get subscription status and usage
  let subscriptionStatus;
  let usage;
  let subscription;

  try {
    subscriptionStatus = await getSubscriptionStatus(userId);
    usage = await getUserUsage(userId);
    subscription = await getUserSubscription(userId);

    // If usage is null and user is on free trial, create a default usage record
    // This ensures the billing page always has data to display
    if (!usage && subscriptionStatus && !subscriptionStatus.hasActiveSubscription) {
      // Get user internal ID
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle();

      if (user) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        // Try to create usage record (might fail if it already exists, that's okay)
        const { error: insertError } = await supabase.from('usage_tracking').insert({
          user_id: user.id,
          month: currentMonth,
          analyses_used: 0,
          analyses_limit: 10, // Free trial limit
        });

        // If insert succeeded or failed (already exists), fetch the usage record
        if (!insertError || insertError.code === '23505') {
          // Recalculate usage info with bundle credits
          usage = await getUserUsage(userId);
        }
      }
    }
  } catch (error) {
    console.error('Error loading billing data:', error);
    // Return error page or fallback
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-slate-900 mb-4">Error Loading Billing</h1>
              <p className="text-slate-600 mb-4">
                There was an error loading your billing information. Please try refreshing the page.
              </p>
              <p className="text-sm text-slate-500">
                Error: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription || false;
  const isOnFreeTrial = !hasActiveSubscription;

  // Map subscription plan_tier to constants format
  // Database uses: 'basic' | 'pro' | 'enterprise'
  // Constants use: 'starter' | 'professional' | 'business'
  const planTierMap: Record<string, keyof typeof PLAN_LIMITS> = {
    basic: 'starter',
    pro: 'professional',
    enterprise: 'business',
    starter: 'starter',
    professional: 'professional',
    business: 'business',
  };

  const currentPlan = subscription?.plan_tier
    ? planTierMap[subscription.plan_tier] || 'starter'
    : 'starter';
  const planLimits = PLAN_LIMITS[currentPlan];
  const planPrices = PLAN_PRICES[currentPlan];

  // Use actual usage data from usage_tracking table
  // If usage is null, create default values for free trial users
  const analysesUsed = usage?.analyses_used ?? 0;
  const analysesLimit = usage?.analyses_limit ?? (isOnFreeTrial ? 10 : 10);
  const remaining = usage?.remaining ?? analysesLimit - analysesUsed;

  // Debug logging for production troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log('Billing page debug:', {
      isOnFreeTrial,
      hasUsage: !!usage,
      analysesUsed,
      analysesLimit,
      remaining,
      bundleCredits: usage?.bundle_credits || 0,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Billing & Subscription</h1>
            <p className="text-slate-600">Manage your subscription and billing information</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Free Trial Status Banner - Always show for free trial users */}
              {isOnFreeTrial && (
                <FreeTrialStatus
                  analysesUsed={analysesUsed}
                  analysesLimit={analysesLimit}
                  remaining={remaining}
                />
              )}

              {/* Bundle Purchase Section */}
              {/* Always show for free trial users, or show for subscribed users who are near limit or have bundle credits */}
              {/* For free trial users, show even if usage is null (will use default values) */}
              {isOnFreeTrial ? (
                <BundlePurchase
                  currentPlan={currentPlan}
                  analysesUsed={analysesUsed}
                  analysesLimit={analysesLimit}
                  bundleCredits={usage?.bundle_credits || 0}
                  isOnFreeTrial={isOnFreeTrial}
                />
              ) : usage ? (
                <BundlePurchase
                  currentPlan={currentPlan}
                  analysesUsed={analysesUsed}
                  analysesLimit={analysesLimit}
                  bundleCredits={usage.bundle_credits || 0}
                  isOnFreeTrial={isOnFreeTrial}
                />
              ) : null}

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    {isOnFreeTrial ? 'Free Trial' : 'Current Plan'}
                  </CardTitle>
                  {!isOnFreeTrial && (
                    <CardDescription>Your active subscription details</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        {!isOnFreeTrial && (
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-bold text-slate-900 capitalize">
                              {`${currentPlan} Plan`}
                            </h3>
                            <Badge
                              className={
                                currentPlan === 'business'
                                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                                  : currentPlan === 'professional'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                              }
                            >
                              Subscribed
                            </Badge>
                          </div>
                        )}
                        <p className="text-3xl font-bold text-slate-900">
                          {isOnFreeTrial ? (
                            <span className="text-lg text-slate-600 font-normal">Free</span>
                          ) : (
                            <>
                              ${planPrices.monthly}
                              <span className="text-lg text-slate-600 font-normal">/month</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-full">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h4 className="font-semibold text-slate-900 mb-3">Plan Features</h4>
                      <ul className="space-y-2">
                        {planLimits.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {!isOnFreeTrial && subscription && (
                      <div className="border-t border-slate-200 pt-6">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Next billing date:{' '}
                            {new Date(subscription.current_period_end).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50"
                        >
                          Cancel Subscription
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    Usage Statistics
                  </CardTitle>
                  <CardDescription>
                    {isOnFreeTrial ? 'Your free trial usage' : 'Your current month activity'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {usage ? (
                      <>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm text-slate-600">Analyses Used</p>
                              <p className="text-xl font-bold text-slate-900">
                                {analysesUsed}{' '}
                                <span className="text-sm font-normal text-slate-600">
                                  / {analysesLimit}
                                  {usage.bundle_credits && usage.bundle_credits > 0 && (
                                    <span className="text-orange-600 ml-1">
                                      {' '}
                                      + {usage.bundle_credits} bundle
                                    </span>
                                  )}
                                </span>
                              </p>
                              {usage.total_available && usage.total_available > analysesLimit && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {usage.total_available} total available
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-slate-900">
                              {usage.percentage}
                              <span className="text-sm text-slate-600">%</span>
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Progress</span>
                            <span className="text-slate-600">
                              {remaining} {remaining === 1 ? 'remaining' : 'remaining'}
                            </span>
                          </div>
                          <Progress value={usage.percentage} className="h-3" />
                        </div>

                        {(isOnFreeTrial || currentPlan === 'starter') && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900 font-medium mb-2">
                              {isOnFreeTrial
                                ? 'Upgrade to continue after your trial'
                                : 'Upgrade for more analyses'}
                            </p>
                            <p className="text-sm text-blue-800">
                              Get more analyses and priority support with Professional or Business
                              plans
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <p>Usage data not available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    Upgrade Plan
                  </CardTitle>
                  <CardDescription>Get more features and analyses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(Object.keys(PLAN_LIMITS) as Array<keyof typeof PLAN_LIMITS>).map((key) => {
                    // For free trial users, show all plans including Starter
                    // For subscribed users, hide their current plan
                    if (!isOnFreeTrial && key === currentPlan) return null;
                    const limits = PLAN_LIMITS[key];
                    const prices = PLAN_PRICES[key];
                    return (
                      <div
                        key={key}
                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="mb-3">
                          <h3 className="font-semibold text-slate-900 capitalize mb-1">{key}</h3>
                          <p className="text-2xl font-bold text-slate-900">
                            ${prices.monthly}
                            <span className="text-sm text-slate-600 font-normal">/mo</span>
                          </p>
                        </div>
                        <ul className="space-y-1 mb-4">
                          {limits.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-700">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <form action="/api/create-checkout-session" method="POST">
                          <input type="hidden" name="plan" value={key} />
                          <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Upgrade to {key}
                          </Button>
                        </form>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-purple-50">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-slate-900 mb-2">Need help?</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Contact our support team for billing assistance
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-slate-300 bg-white hover:bg-slate-50"
                  >
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
