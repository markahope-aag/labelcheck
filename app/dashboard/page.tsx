import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Camera, History, CreditCard, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Get internal Supabase user ID from Clerk user ID
  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  // If user doesn't exist in database yet, show empty dashboard
  // (The Clerk webhook should create them soon)
  const analyses = user ? (await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)).data : null;

  const totalAnalyses = user ? (await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)).count : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Welcome back!</p>
        </div>

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
              <CardTitle className="text-xl font-semibold text-slate-900">Recent Analyses</CardTitle>
              <CardDescription>Your latest food label scans</CardDescription>
            </CardHeader>
            <CardContent>
              {analyses && analyses.length > 0 ? (
                <div className="space-y-4">
                  {analyses.map((analysis) => {
                    const result = analysis.analysis_result || {};
                    const productName = result.product_name || analysis.image_name || 'Unnamed Product';
                    const summary = result.overall_assessment?.summary || result.summary || 'No summary available';

                    return (
                      <div key={analysis.id} className="flex items-start justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 mb-1">{productName}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{summary}</p>
                          <p className="text-xs text-slate-500 mt-2">{new Date(analysis.created_at).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/history?id=${analysis.id}`}>
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
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
              <CardTitle className="text-xl font-semibold text-slate-900">Get Started</CardTitle>
              <CardDescription>Make the most of NutriScan AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Camera className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">Upload a Label</h4>
                    <p className="text-sm text-slate-600">Take a photo or upload an image of any food label to get started</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">Get Instant Analysis</h4>
                    <p className="text-sm text-slate-600">Receive detailed nutritional insights and health recommendations</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <History className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-1">Track Your Progress</h4>
                    <p className="text-sm text-slate-600">Review past analyses and make informed dietary choices</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
