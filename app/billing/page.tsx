import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Check, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { PLAN_LIMITS, PLAN_PRICES } from '@/lib/constants';

export default async function BillingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const currentPlan = user?.subscription_tier || 'starter';
  const planLimits = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];
  const planPrices = PLAN_PRICES[currentPlan as keyof typeof PLAN_PRICES];

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
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    Current Plan
                  </CardTitle>
                  <CardDescription>Your active subscription details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold text-slate-900 capitalize">
                            {currentPlan} Plan
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
                        <p className="text-3xl font-bold text-slate-900">
                          ${planPrices.monthly}
                          <span className="text-lg text-slate-600 font-normal">/month</span>
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

                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Next billing date:{' '}
                          {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full border-red-300 text-red-600 hover:bg-red-50"
                      >
                        Cancel Subscription
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    Usage Statistics
                  </CardTitle>
                  <CardDescription>Your current month activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Analyses Used</p>
                          <p className="text-xl font-bold text-slate-900">
                            {user?.analyses_count || 0}{' '}
                            <span className="text-sm font-normal text-slate-600">
                              / {planLimits.analyses}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">
                          {Math.min(
                            100,
                            Math.round(((user?.analyses_count || 0) / planLimits.analyses) * 100)
                          )}
                          <span className="text-sm text-slate-600">%</span>
                        </p>
                      </div>
                    </div>

                    {currentPlan === 'starter' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">
                          Upgrade for more analyses
                        </p>
                        <p className="text-sm text-blue-800">
                          Get more analyses and priority support with Professional or Business plans
                        </p>
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
                    if (key === currentPlan) return null;
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
