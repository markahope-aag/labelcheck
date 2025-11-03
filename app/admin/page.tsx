'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, FileText, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalAnalyses: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  analysesThisMonth: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Failed to load stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats
    ? [
        {
          title: 'Total Users',
          value: stats.totalUsers.toLocaleString(),
          description: `+${stats.newUsersThisMonth} this month`,
          icon: Users,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
        },
        {
          title: 'Active Subscriptions',
          value: stats.activeSubscriptions.toLocaleString(),
          description: 'Paying customers',
          icon: CreditCard,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
        },
        {
          title: 'Total Analyses',
          value: stats.totalAnalyses.toLocaleString(),
          description: `${stats.analysesThisMonth} this month`,
          icon: FileText,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
        },
        {
          title: 'Monthly Revenue',
          value: `$${stats.monthlyRevenue.toLocaleString()}`,
          description: 'Current month',
          icon: DollarSign,
          iconColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
        },
      ]
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your application metrics</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">New user registration</p>
                      <p className="text-xs text-gray-500">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-green-50 p-2 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">New subscription</p>
                      <p className="text-xs text-gray-500">15 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-50 p-2 rounded-lg">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Analysis completed</p>
                      <p className="text-xs text-gray-500">23 minutes ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common admin tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <a
                    href="/admin/users"
                    className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Manage Users</p>
                        <p className="text-xs text-gray-500">View and edit user accounts</p>
                      </div>
                    </div>
                  </a>
                  <a
                    href="/admin/pricing"
                    className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Update Pricing</p>
                        <p className="text-xs text-gray-500">Modify subscription plans</p>
                      </div>
                    </div>
                  </a>
                  <a
                    href="/admin/documents"
                    className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Regulatory Documents</p>
                        <p className="text-xs text-gray-500">Manage compliance rules</p>
                      </div>
                    </div>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
