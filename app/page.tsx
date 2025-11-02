/**
 * Landing page for LabelCheck - a FDA/USDA compliance checking service for product labels.
 * 
 * This page serves as the marketing homepage and entry point for unauthenticated users.
 * It includes:
 * - Hero section with value proposition and call-to-action buttons
 * - "How It Works" section explaining the 3-step process (Upload, Analyze, Report)
 * - "Why Choose LabelCheck" section highlighting key features (allergen detection, GRAS verification, claims analysis, etc.)
 * - Pricing section with three tiers (Starter, Professional, Business)
 * - Customer testimonials section
 * - Final call-to-action section
 * 
 * Authenticated users are automatically redirected to the dashboard.
 */

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
                Launch FDA-Compliant Products
                <span className="text-blue-600"> Confidently</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Check allergens, GRAS, and claims—not just nutrition facts—in minutes.
                From $49/month. No $240+ consultant fees.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="text-lg px-8" asChild>
                  <Link href="/sign-up">
                    Start Free Trial - 10 Analyses
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" asChild>
                  <Link href="/pricing">
                    View Pricing
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                No credit card required • Start analyzing in 2 minutes
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
                    Simply upload a photo or image of your packaging label.
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
                Comprehensive compliance checking beyond nutrition facts
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Beyond Nutrition Facts</h3>
                  <p className="text-gray-600 text-sm">
                    Unlike nutrition generators that only check nutrition panels, we verify allergens, GRAS, claims, and all FDA/USDA requirements
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Minutes, Not Weeks</h3>
                  <p className="text-gray-600 text-sm">
                    Get comprehensive compliance reports in 60 seconds vs. 1-2 weeks with regulatory consultants
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Affordable Compliance</h3>
                  <p className="text-gray-600 text-sm">
                    $49-399/month vs. $240+ per consultant review. Unlimited revisions included. Break even after just 1 review
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">9 Major Allergens</h3>
                  <p className="text-gray-600 text-sm">
                    Automatic detection of FALCPA/FASTER allergens with 400+ derivatives. Catches hidden sources like "whey" (milk) and "albumin" (eggs)
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">GRAS & NDI Verification</h3>
                  <p className="text-gray-600 text-sm">
                    1,465 FDA-approved GRAS ingredients for foods and 1,253 NDI notifications + 2,193 grandfathered ingredients for supplements
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Claims Analysis</h3>
                  <p className="text-gray-600 text-sm">
                    Flags prohibited health claims, misleading marketing terms, and unsubstantiated structure/function claims
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-gray-600">
                Start with 10 free analyses. No credit card required.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-2">Starter</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6">
                    Perfect for small brands with 3-5 SKUs
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>10 analyses/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Full FDA compliance checking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>PDF export</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Email support</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-600 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-2">Professional</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6">
                    For growing brands with 10-20 SKUs
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>50 analyses/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Full FDA compliance checking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>PDF/CSV export</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Priority support</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Analysis history (1 year)</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-2">Business</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">$399</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6">
                    For large brands with 50+ SKUs
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>200 analyses/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Full FDA compliance checking</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>All export formats</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Phone support</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Unlimited history</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span>Team collaboration</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-12">
              <p className="text-gray-600 mb-4">
                Save 17% with annual billing (2 months free)
              </p>
              <Button size="lg" asChild>
                <Link href="/pricing">
                  View Full Pricing Details
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gray-50">
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
              Start analyzing your labels today. No credit card required.
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
