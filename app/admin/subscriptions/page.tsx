'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, TrendingUp, Users, Calendar, Mail, DollarSign } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  plan_tier: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  users?: {
    email: string;
  };
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState({ active: 0, canceled: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/subscriptions');
      if (!response.ok) throw new Error('Failed to load subscriptions');
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || { active: 0, canceled: 0, total: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadge = (planTier: string) => {
    switch (planTier) {
      case 'pro':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Pro</Badge>;
      case 'enterprise':
        return (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">Enterprise</Badge>
        );
      case 'basic':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Basic</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Canceled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Past Due</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Trialing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanPrice = (planTier: string) => {
    switch (planTier) {
      case 'basic':
        return '$29/mo';
      case 'pro':
        return '$99/mo';
      case 'enterprise':
        return '$299/mo';
      default:
        return 'Free';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-600 mt-2">Manage customer subscriptions and billing</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Subscriptions
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Canceled</CardTitle>
            <CreditCard className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.canceled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions ({subscriptions.length})</CardTitle>
          <CardDescription>View and manage customer subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No subscriptions found</p>
              <p className="text-sm text-gray-500 mt-2">
                Subscriptions will appear here as users subscribe
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 h-10 w-10 rounded-full flex items-center justify-center">
                            <Mail className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {sub.users?.email || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {sub.user_id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(sub.plan_tier)}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{getPlanPrice(sub.plan_tier)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {new Date(sub.current_period_end).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {new Date(sub.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
