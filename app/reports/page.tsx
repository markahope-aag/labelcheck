'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { BarChart3, FileText, TrendingUp, Calendar, Download } from 'lucide-react';
import { exportAnalysesAsPDF } from '@/lib/export-helpers';
import { clientLogger } from '@/lib/client-logger';

interface MonthlyStats {
  month: string;
  total_analyses: number;
  avg_health_score: number;
  compliant_count: number;
  total_issues: number;
}

export default function ReportsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [yearlyTotals, setYearlyTotals] = useState({
    total: 0,
    avgScore: 0,
    compliant: 0,
    issues: 0,
  });

  useEffect(() => {
    loadReportData();
  }, [user, selectedYear]);

  async function loadReportData() {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data: analyses, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', userData.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const monthlyData: { [key: string]: any } = {};
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      monthNames.forEach((month, index) => {
        monthlyData[month] = {
          month,
          monthNum: index + 1,
          total_analyses: 0,
          total_health_score: 0,
          compliant_count: 0,
          total_issues: 0,
        };
      });

      let yearTotal = 0;
      let yearScoreSum = 0;
      let yearCompliant = 0;
      let yearIssues = 0;

      (analyses || []).forEach((analysis: any) => {
        const date = new Date(analysis.created_at);
        const monthName = monthNames[date.getMonth()];
        const result = analysis.analysis_result || {};

        monthlyData[monthName].total_analyses++;
        monthlyData[monthName].total_health_score += result.health_score || 0;
        monthlyData[monthName].total_issues += analysis.issues_found || 0;

        if (analysis.compliance_status === 'compliant') {
          monthlyData[monthName].compliant_count++;
        }

        yearTotal++;
        yearScoreSum += result.health_score || 0;
        yearIssues += analysis.issues_found || 0;
        if (analysis.compliance_status === 'compliant') yearCompliant++;
      });

      const statsArray: MonthlyStats[] = Object.values(monthlyData).map((m: any) => ({
        month: m.month,
        total_analyses: m.total_analyses,
        avg_health_score:
          m.total_analyses > 0 ? Math.round(m.total_health_score / m.total_analyses) : 0,
        compliant_count: m.compliant_count,
        total_issues: m.total_issues,
      }));

      setMonthlyStats(statsArray);
      setYearlyTotals({
        total: yearTotal,
        avgScore: yearTotal > 0 ? Math.round(yearScoreSum / yearTotal) : 0,
        compliant: yearCompliant,
        issues: yearIssues,
      });
    } catch (error) {
      clientLogger.error('Failed to load report data', { error, selectedYear });
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function exportMonthlyReport(month: string) {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      const monthIndex = monthlyStats.findIndex((m) => m.month === month);
      const startDate = new Date(parseInt(selectedYear), monthIndex, 1);
      const endDate = new Date(parseInt(selectedYear), monthIndex + 1, 0);

      const { data: analyses } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', userData.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!analyses || analyses.length === 0) {
        toast({
          title: 'No Data',
          description: `No analyses found for ${month} ${selectedYear}`,
          variant: 'destructive',
        });
        return;
      }

      await exportAnalysesAsPDF(analyses);

      toast({
        title: 'Success',
        description: `Exported ${analyses.length} analyses from ${month}`,
      });
    } catch (error) {
      clientLogger.error('Monthly report export failed', { error, month, selectedYear });
      toast({
        title: 'Error',
        description: 'Failed to export report',
        variant: 'destructive',
      });
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-16">Loading reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analysis Reports</h1>
            <p className="text-muted-foreground">Monthly breakdown of your label analyses</p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Analyses</CardDescription>
              <CardTitle className="text-3xl">{yearlyTotals.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span>in {selectedYear}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average Score</CardDescription>
              <CardTitle className="text-3xl">{yearlyTotals.avgScore}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>out of 100</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Compliant Products</CardDescription>
              <CardTitle className="text-3xl">{yearlyTotals.compliant}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {yearlyTotals.total > 0
                  ? Math.round((yearlyTotals.compliant / yearlyTotals.total) * 100)
                  : 0}
                % compliance rate
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Issues</CardDescription>
              <CardTitle className="text-3xl">{yearlyTotals.issues}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {yearlyTotals.total > 0 ? (yearlyTotals.issues / yearlyTotals.total).toFixed(1) : 0}{' '}
                avg per product
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Breakdown</CardTitle>
            <CardDescription>Analysis statistics by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyStats.map((stat) => (
                <div
                  key={stat.month}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold">{stat.month}</p>
                        <p className="text-sm text-muted-foreground">
                          {stat.total_analyses}{' '}
                          {stat.total_analyses === 1 ? 'analysis' : 'analyses'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {stat.total_analyses > 0 && (
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Avg Score</p>
                        <p className="text-lg font-semibold">{stat.avg_health_score}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Compliant</p>
                        <p className="text-lg font-semibold text-green-600">
                          {stat.compliant_count}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Issues</p>
                        <p className="text-lg font-semibold text-orange-600">{stat.total_issues}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportMonthlyReport(stat.month)}
                        disabled={stat.total_analyses === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  )}

                  {stat.total_analyses === 0 && (
                    <p className="text-sm text-muted-foreground">No analyses this month</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
