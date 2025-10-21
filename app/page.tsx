import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Upload, Zap, Shield, FileCheck, TrendingUp } from 'lucide-react';

export default async function Home() {
  const { userId } = await auth();

  // Redirect logged-in users to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col">
        <section className="bg-gradient-to-b from-blue-50 to-white py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                AI-Powered Food Label
                <span className="text-blue-600"> Compliance Checking</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Analyze food packaging labels for FDA and USDA regulatory compliance in seconds.
                Ensure your products meet all requirements before hitting the market.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href="/sign-up">
                    Start Free Analysis
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                  <Link href="/pricing">
                    View Pricing
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                No credit card required • Get started in 2 minutes
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600">
                Three simple steps to ensure compliance
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">1. Upload Label</h3>
                  <p className="text-gray-600">
                    Simply upload a photo or image of your food packaging label.
                    We accept JPG, PNG, and other common formats.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">2. AI Analysis</h3>
                  <p className="text-gray-600">
                    Our advanced AI analyzes your label against FDA and USDA regulations
                    in seconds, checking every detail.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <FileCheck className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">3. Get Report</h3>
                  <p className="text-gray-600">
                    Receive a detailed compliance report with actionable recommendations
                    to fix any issues found.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose LabelCheck?
              </h2>
              <p className="text-lg text-gray-600">
                The most comprehensive food label compliance solution
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">FDA & USDA Compliance</h3>
                  <p className="text-gray-600 text-sm">
                    Comprehensive checks against all FDA and USDA food labeling requirements
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Instant Results</h3>
                  <p className="text-gray-600 text-sm">
                    Get detailed compliance reports in seconds, not days or weeks
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Actionable Recommendations</h3>
                  <p className="text-gray-600 text-sm">
                    Clear guidance on how to fix any compliance issues found
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Allergen Detection</h3>
                  <p className="text-gray-600 text-sm">
                    Automatic checking of major allergen declarations and formatting
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Nutrition Facts Validation</h3>
                  <p className="text-gray-600 text-sm">
                    Verify proper formatting and completeness of nutrition information
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Analysis History</h3>
                  <p className="text-gray-600 text-sm">
                    Keep track of all your analyses and compliance improvements over time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Trusted by Food Companies
              </h2>
              <p className="text-lg text-gray-600">
                Join hundreds of companies ensuring label compliance
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600 mb-4">
                    "LabelCheck saved us weeks of back-and-forth with regulatory consultants.
                    The AI catches issues we would have missed."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-sm">Sarah Johnson</p>
                      <p className="text-gray-500 text-xs">Product Manager, Fresh Foods Co.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600 mb-4">
                    "We've reduced our time to market by 40% using LabelCheck. The detailed
                    reports make it easy to fix issues quickly."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-sm">Michael Chen</p>
                      <p className="text-gray-500 text-xs">Compliance Director, Organic Snacks Inc.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600 mb-4">
                    "The peace of mind knowing our labels are compliant before printing is invaluable.
                    This tool is a game-changer."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-sm">Emily Rodriguez</p>
                      <p className="text-gray-500 text-xs">Founder, Artisan Beverage Co.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-blue-600 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Ensure Label Compliance?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Start analyzing your food labels today. No credit card required.
            </p>
            <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
              <Link href="/sign-up">
                Get Started Free
              </Link>
            </Button>
          </div>
        </section>
    </div>
  );
}
