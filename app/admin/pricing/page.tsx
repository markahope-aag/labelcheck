'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, Check, Save, AlertCircle } from 'lucide-react';

interface PricingPlan {
  tier: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  limits: {
    analyses: number;
    teamMembers: number;
  };
}

export default function AdminPricingPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([
    {
      tier: 'basic',
      name: 'Basic',
      price: 29,
      interval: 'month',
      features: [
        '10 analyses per month',
        'Basic compliance checking',
        'PDF export',
        'Email support',
        '1 team member',
      ],
      limits: {
        analyses: 10,
        teamMembers: 1,
      },
    },
    {
      tier: 'pro',
      name: 'Professional',
      price: 99,
      interval: 'month',
      features: [
        '100 analyses per month',
        'Advanced compliance checking',
        'PDF & CSV export',
        'Priority email support',
        'Up to 5 team members',
        'API access',
        'Custom branding',
      ],
      limits: {
        analyses: 100,
        teamMembers: 5,
      },
    },
    {
      tier: 'enterprise',
      name: 'Enterprise',
      price: 299,
      interval: 'month',
      features: [
        'Unlimited analyses',
        'Full compliance suite',
        'All export formats',
        '24/7 phone & email support',
        'Unlimited team members',
        'Advanced API access',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
      ],
      limits: {
        analyses: -1,
        teamMembers: -1,
      },
    },
  ]);

  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const handlePriceChange = (tier: string, newPrice: number) => {
    setPlans(plans.map(plan =>
      plan.tier === tier ? { ...plan, price: newPrice } : plan
    ));
  };

  const handleLimitChange = (tier: string, limitType: 'analyses' | 'teamMembers', value: number) => {
    setPlans(plans.map(plan =>
      plan.tier === tier
        ? { ...plan, limits: { ...plan.limits, [limitType]: value } }
        : plan
    ));
  };

  const handleSave = async (tier: string) => {
    // In production, this would make an API call to update Stripe prices
    setSaveMessage(`${tier} plan updated successfully`);
    setEditingPlan(null);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
        <p className="text-gray-600 mt-2">Configure subscription plans and pricing</p>
      </div>

      {saveMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Changes to pricing require updating Stripe product configurations. Make sure to sync with your Stripe dashboard after making changes.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isEditing = editingPlan === plan.tier;

          return (
            <Card key={plan.tier} className="relative">
              {plan.tier === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white">Most Popular</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-gray-600">
                  {plan.tier === 'basic' && 'For individuals getting started'}
                  {plan.tier === 'pro' && 'For growing businesses'}
                  {plan.tier === 'enterprise' && 'For large organizations'}
                </CardDescription>

                <div className="mt-4">
                  {isEditing ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-8 w-8 text-gray-400" />
                        <Input
                          type="number"
                          value={plan.price}
                          onChange={(e) => handlePriceChange(plan.tier, parseFloat(e.target.value))}
                          className="w-24 text-center text-3xl font-bold"
                        />
                      </div>
                      <span className="text-sm text-gray-600">per {plan.interval}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-5xl font-bold text-gray-900">
                        ${plan.price}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">per {plan.interval}</div>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {isEditing && (
                  <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label>Analyses Limit</Label>
                      <Input
                        type="number"
                        value={plan.limits.analyses}
                        onChange={(e) => handleLimitChange(plan.tier, 'analyses', parseInt(e.target.value))}
                        className="mt-1"
                        placeholder="-1 for unlimited"
                      />
                      <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
                    </div>
                    <div>
                      <Label>Team Members Limit</Label>
                      <Input
                        type="number"
                        value={plan.limits.teamMembers}
                        onChange={(e) => handleLimitChange(plan.tier, 'teamMembers', parseInt(e.target.value))}
                        className="mt-1"
                        placeholder="-1 for unlimited"
                      />
                      <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
                    </div>
                  </div>
                )}

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2">
                  {isEditing ? (
                    <>
                      <Button
                        className="w-full"
                        onClick={() => handleSave(plan.tier)}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setEditingPlan(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setEditingPlan(plan.tier)}
                    >
                      Edit Plan
                    </Button>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t text-xs text-gray-500 space-y-1">
                  <p>Tier: <span className="font-medium">{plan.tier}</span></p>
                  <p>Analyses: <span className="font-medium">
                    {plan.limits.analyses === -1 ? 'Unlimited' : plan.limits.analyses}
                  </span></p>
                  <p>Team Members: <span className="font-medium">
                    {plan.limits.teamMembers === -1 ? 'Unlimited' : plan.limits.teamMembers}
                  </span></p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Stripe Integration</CardTitle>
          <CardDescription>Sync pricing with Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Label className="text-sm text-gray-600">Basic Plan ID</Label>
                <code className="block mt-2 text-xs bg-gray-100 p-2 rounded">
                  {process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_BASIC || 'Not configured'}
                </code>
              </div>
              <div className="p-4 border rounded-lg">
                <Label className="text-sm text-gray-600">Pro Plan ID</Label>
                <code className="block mt-2 text-xs bg-gray-100 p-2 rounded">
                  {process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || 'Not configured'}
                </code>
              </div>
              <div className="p-4 border rounded-lg">
                <Label className="text-sm text-gray-600">Enterprise Plan ID</Label>
                <code className="block mt-2 text-xs bg-gray-100 p-2 rounded">
                  {process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ENTERPRISE || 'Not configured'}
                </code>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Price changes in this interface are for display purposes only. To update actual billing amounts,
                create new prices in Stripe and update your environment variables.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
