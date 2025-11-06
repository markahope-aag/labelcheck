import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  History,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabaseAdmin } from '@/lib/supabase';
import { getSubscriptionStatus, getUserUsage } from '@/lib/subscription-helpers';
import { FreeTrialStatus } from '@/components/FreeTrialStatus';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get subscription status and usage for Free Trial display
  const subscriptionStatus = await getSubscriptionStatus(userId);
  const usage = await getUserUsage(userId);
  const isOnFreeTrial = !subscriptionStatus.hasActiveSubscription;

  // Get internal Supabase user ID from Clerk user ID
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  // If user doesn't exist in database yet, show empty dashboard
  // (The Clerk webhook should create them soon)
  const analyses = user
    ? (
        await supabaseAdmin
          .from('analyses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3)
      ).data
    : null;

  const totalAnalyses = user
    ? (
        await supabaseAdmin
          .from('analyses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ).count
    : 0;

  // Get compliance statistics
  const allAnalyses = user
    ? (await supabaseAdmin.from('analyses').select('analysis_result').eq('user_id', user.id)).data
    : null;

  const compliantCount =
    allAnalyses?.filter((a) => {
      const status = a.analysis_result?.overall_assessment?.status || '';
      return status.toLowerCase() === 'compliant';
    }).length || 0;

  const issuesCount =
    allAnalyses?.filter((a) => {
      const status = a.analysis_result?.overall_assessment?.status || '';
      return (
        status.toLowerCase() === 'non-compliant' ||
        status.toLowerCase() === 'potentially-non-compliant' ||
        status.toLowerCase() === 'minor-issues'
      );
    }).length || 0;

  const complianceRate =
    totalAnalyses && totalAnalyses > 0 ? Math.round((compliantCount / totalAnalyses) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Welcome back!</p>
        </div>

        {/* Free Trial Status Banner */}
        {isOnFreeTrial && usage && (
          <div className="mb-8">
            <FreeTrialStatus
              analysesUsed={usage.analyses_used}
              analysesLimit={usage.analyses_limit}
              remaining={usage.remaining}
              trialDaysRemaining={usage.trial_days_remaining ?? null}
              trialExpired={usage.trial_expired ?? false}
            />
          </div>
        )}

        {/* Bundle Credits Display */}
        {usage && usage.bundle_credits && usage.bundle_credits > 0 && (
          <div className="mb-8">
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Bundle Credits</h3>
                    <p className="text-sm text-slate-600">
                      You have {usage.bundle_credits} bundle{' '}
                      {usage.bundle_credits === 1 ? 'credit' : 'credits'} available
                    </p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                    {usage.bundle_credits} Remaining
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="border-slate-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Analyses</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalAnalyses || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Lifetime scans</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Recent Activity</CardTitle>
              <History className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{analyses?.length || 0}</div>
              <p className="text-xs text-slate-500 mt-1">This week</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/analyze">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Camera className="h-4 w-4 mr-2" />
                  New Scan
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200 hover:shadow-lg transition-shadow">
            <CardHeader className="space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/billing">
                <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-slate-900">
                Recent Analyses
              </CardTitle>
              <CardDescription>Your latest label scans</CardDescription>
            </CardHeader>
            <CardContent>
              {analyses && analyses.length > 0 ? (
                <div className="space-y-4">
                  {analyses.map((analysis) => {
                    const result = analysis.analysis_result || {};
                    const productName =
                      result.product_name || analysis.image_name || 'Unnamed Product';
                    const summary =
                      result.overall_assessment?.summary ||
                      result.summary ||
                      'No summary available';

                    return (
                      <div
                        key={analysis.id}
                        className="flex items-start justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 mb-1">{productName}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{summary}</p>
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(analysis.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link href={`/history?id=${analysis.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                  <Link href="/history">
                    <Button variant="link" className="w-full text-blue-600 hover:text-blue-700">
                      View All Analyses →
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Camera className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">No analyses yet</p>
                  <Link href="/analyze">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Your First Scan
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-slate-900">
                Compliance Overview
              </CardTitle>
              <CardDescription>Your regulatory compliance at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              {totalAnalyses && totalAnalyses > 0 ? (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-900">{totalAnalyses}</div>
                      <div className="text-xs text-slate-600 mt-1">Total Analyses</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div className="text-2xl font-bold text-green-700">{compliantCount}</div>
                      </div>
                      <div className="text-xs text-green-600 mt-1">Compliant</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div className="text-2xl font-bold text-red-700">{issuesCount}</div>
                      </div>
                      <div className="text-xs text-red-600 mt-1">With Issues</div>
                    </div>
                  </div>

                  {/* Compliance Rate */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-slate-900">Compliance Rate</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-700">{complianceRate}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${complianceRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Usage This Month */}
                  {usage && (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">Usage This Month</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {usage.analyses_used} of{' '}
                          {usage.analyses_limit === -1 ? '∞' : usage.analyses_limit}
                        </span>
                      </div>
                      {usage.analyses_limit !== -1 && (
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-slate-600 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min((usage.analyses_used / usage.analyses_limit) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-2">No compliance data yet</p>
                  <p className="text-sm text-slate-500 mb-4">
                    Analyze your first label to see compliance insights
                  </p>
                  <Link href="/analyze">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Camera className="h-4 w-4 mr-2" />
                      Start First Analysis
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
