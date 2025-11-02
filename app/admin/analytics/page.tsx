'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  DollarSign,
  Activity,
  Calendar,
  BarChart3,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AnalyticsData {
  growth: {
    users: { current: number; previous: number; percentage: number };
    revenue: { current: number; previous: number; percentage: number };
    analyses: { current: number; previous: number; percentage: number };
    subscriptions: { current: number; previous: number; percentage: number };
  };
  topUsers: Array<{
    email: string;
    analyses_count: number;
    plan_tier: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30d');

  // Mock data - in production, this would come from API
  const [analytics] = useState<AnalyticsData>({
    growth: {
      users: { current: 156, previous: 142, percentage: 9.9 },
      revenue: { current: 8940, previous: 7320, percentage: 22.1 },
      analyses: { current: 2847, previous: 2103, percentage: 35.4 },
      subscriptions: { current: 89, previous: 76, percentage: 17.1 },
    },
    topUsers: [
      { email: 'user1@example.com', analyses_count: 342, plan_tier: 'enterprise' },
      { email: 'user2@example.com', analyses_count: 298, plan_tier: 'pro' },
      { email: 'user3@example.com', analyses_count: 256, plan_tier: 'pro' },
      { email: 'user4@example.com', analyses_count: 187, plan_tier: 'enterprise' },
      { email: 'user5@example.com', analyses_count: 143, plan_tier: 'basic' },
    ],
    recentActivity: [
      {
        id: '1',
        type: 'new_user',
        description: 'New user registration',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: '2',
        type: 'subscription',
        description: 'New Pro subscription',
        timestamp: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
      },
      {
        id: '3',
        type: 'analysis',
        description: '50 analyses completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: '4',
        type: 'upgrade',
        description: 'Basic to Pro upgrade',
        timestamp: new Date(Date.now() - 1000 * 60 * 67).toISOString(),
      },
      {
        id: '5',
        type: 'churn',
        description: 'Subscription canceled',
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
    ],
  });

  useEffect(() => {
    // Simulate loading
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  }, [timeRange]);

  const getGrowthIndicator = (percentage: number) => {
    const isPositive = percentage >= 0;
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span className="text-sm font-medium">{Math.abs(percentage).toFixed(1)}%</span>
      </div>
    );
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'new_user':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'subscription':
      case 'upgrade':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'analysis':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'churn':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">Track growth and user engagement</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              {range === '7d' && 'Last 7 days'}
              {range === '30d' && 'Last 30 days'}
              {range === '90d' && 'Last 90 days'}
              {range === '1y' && 'Last year'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Growth Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
                <Users className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics.growth.users.current}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getGrowthIndicator(analytics.growth.users.percentage)}
                  <span className="text-xs text-gray-500">from last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  ${analytics.growth.revenue.current.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getGrowthIndicator(analytics.growth.revenue.percentage)}
                  <span className="text-xs text-gray-500">from last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Analyses</CardTitle>
                <FileText className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics.growth.analyses.current.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getGrowthIndicator(analytics.growth.analyses.percentage)}
                  <span className="text-xs text-gray-500">from last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Subscriptions</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  {analytics.growth.subscriptions.current}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getGrowthIndicator(analytics.growth.subscriptions.percentage)}
                  <span className="text-xs text-gray-500">from last period</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Top Users */}
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Activity</CardTitle>
                <CardDescription>Users with most analyses completed</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Analyses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topUsers.map((user, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{getPlanBadge(user.plan_tier)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {user.analyses_count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="bg-gray-100 p-2 rounded-lg">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {formatTimestamp(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Analysis activity over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">Chart visualization</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Integrate with a charting library like Recharts or Chart.js
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
