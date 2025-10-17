'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Search, Calendar, TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { exportAnalysesAsCSV, exportAnalysesAsJSON, exportAnalysesAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

export default function HistoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  useEffect(() => {
    loadAnalyses();
  }, [user]);

  async function loadAnalyses() {
    if (!user) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error('Error loading analyses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analysis history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!analyses || analyses.length === 0) {
      toast({
        title: 'No Data',
        description: 'No analyses available to export',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (exportFormat === 'pdf') {
        await exportAnalysesAsPDF(analyses);
      } else if (exportFormat === 'csv') {
        exportAnalysesAsCSV(analyses);
      } else {
        exportAnalysesAsJSON(analyses);
      }

      toast({
        title: 'Success',
        description: `Exported ${analyses.length} analyses as ${exportFormat.toUpperCase()}`,
      });

      supabase.from('analysis_exports').insert({
        analysis_id: analyses[0].id,
        user_id: analyses[0].user_id,
        export_format: exportFormat === 'pdf' ? 'pdf' : exportFormat,
      });
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: 'Error',
        description: 'Failed to export analyses',
        variant: 'destructive',
      });
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 70) return <TrendingUp className="h-4 w-4" />;
    if (score >= 40) return <Minus className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-16">Loading analysis history...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Analysis History</h1>
              <p className="text-slate-600">Review all your past food label analyses</p>
            </div>
            {analyses && analyses.length > 0 && (
              <div className="flex items-center gap-3">
                <Select value={exportFormat} onValueChange={(value: 'pdf' | 'csv' | 'json') => setExportFormat(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleExport} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            )}
          </div>

          {analyses && analyses.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{analyses.length}</span> analysis{analyses.length !== 1 ? 'es' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {analyses.map((analysis) => {
                  const result = analysis.analysis_result || {};
                  return (
                    <Card key={analysis.id} className="border-slate-200 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl font-semibold text-slate-900 mb-2">
                              {result.product_name || 'Unnamed Product'}
                            </CardTitle>
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(analysis.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </div>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                {new Date(analysis.created_at).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                          {result.health_score !== null && result.health_score !== undefined && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getHealthScoreColor(result.health_score)}`}>
                              {getHealthScoreIcon(result.health_score)}
                              <span className="font-semibold">{result.health_score}/100</span>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {result.summary && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Summary</h4>
                              <p className="text-slate-600 leading-relaxed">{result.summary}</p>
                            </div>
                          )}

                          {result.ingredients && result.ingredients.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Ingredients</h4>
                              <div className="flex flex-wrap gap-2">
                                {result.ingredients.slice(0, 8).map((ingredient: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                    {ingredient}
                                  </Badge>
                                ))}
                                {result.ingredients.length > 8 && (
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                    +{result.ingredients.length - 8} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {result.nutrition_facts && Object.keys(result.nutrition_facts).length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Key Nutrition Facts</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(result.nutrition_facts)
                                  .slice(0, 4)
                                  .map(([key, value]) => (
                                    <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                      <p className="text-xs text-slate-600 capitalize mb-1">{key.replace('_', ' ')}</p>
                                      <p className="text-sm font-semibold text-slate-900">{value as string}</p>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {result.recommendations && result.recommendations.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Top Recommendations</h4>
                              <ul className="space-y-1">
                                {result.recommendations.slice(0, 3).map((rec: string, index: number) => (
                                  <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="text-blue-600 mt-0.5">•</span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="bg-slate-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No analyses yet</h3>
                  <p className="text-slate-600 mb-6">Start analyzing food labels to see your history here</p>
                  <a href="/analyze" className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Analyze Your First Label
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
