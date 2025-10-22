'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Search, Calendar, Download, Eye, FileText, Filter, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { exportAnalysesAsCSV, exportAnalysesAsJSON, exportAnalysesAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

export default function HistoryPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name'>('date-desc');

  useEffect(() => {
    loadAnalyses();
  }, [user]);

  useEffect(() => {
    filterAndSortAnalyses();
  }, [analyses, searchQuery, statusFilter, sortBy]);

  function filterAndSortAnalyses() {
    let filtered = [...analyses];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((analysis) => {
        const result = analysis.analysis_result;
        const productName = (result.product_name || '').toLowerCase();
        const productType = (result.product_type || '').toLowerCase();
        const summary = (result.overall_assessment?.summary || result.summary || '').toLowerCase();

        return productName.includes(query) ||
               productType.includes(query) ||
               summary.includes(query);
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((analysis) => {
        const status = analysis.analysis_result.overall_assessment?.primary_compliance_status || analysis.compliance_status;

        if (statusFilter === 'compliant') {
          return status === 'compliant' || status === 'likely_compliant';
        } else if (statusFilter === 'non-compliant') {
          return status === 'potentially_non_compliant' || status === 'non_compliant' || status === 'major_violations';
        }

        return analysis.compliance_status === statusFilter;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'date-asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'name') {
        const nameA = (a.analysis_result.product_name || '').toLowerCase();
        const nameB = (b.analysis_result.product_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    setFilteredAnalyses(filtered);
  }

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
              <p className="text-slate-600">Review all your past label analyses</p>
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
              {/* Search and Filter Bar */}
              <Card className="border-slate-200">
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search by product name, type, or summary..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full lg:w-48">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="compliant">Compliant</SelectItem>
                        <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                        <SelectItem value="minor_issues">Minor Issues</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-full lg:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Newest First</SelectItem>
                        <SelectItem value="date-asc">Oldest First</SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{filteredAnalyses.length}</span> of <span className="font-semibold text-slate-900">{analyses.length}</span> analysis{analyses.length !== 1 ? 'es' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {filteredAnalyses.map((analysis) => {
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
                          {result.overall_assessment?.primary_compliance_status && (
                            <div>
                              <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                result.overall_assessment.primary_compliance_status === 'compliant' ? 'bg-green-100 text-green-800 border-green-200 border' :
                                result.overall_assessment.primary_compliance_status === 'likely_compliant' ? 'bg-green-50 text-green-700 border-green-200 border' :
                                result.overall_assessment.primary_compliance_status === 'potentially_non_compliant' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 border' :
                                'bg-red-100 text-red-800 border-red-200 border'
                              }`}>
                                {result.overall_assessment.primary_compliance_status.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {(result.overall_assessment?.summary || result.summary) && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Summary</h4>
                              <p className="text-slate-600 leading-relaxed">{result.overall_assessment?.summary || result.summary}</p>
                            </div>
                          )}

                          {((result.ingredient_labeling?.ingredients_list || result.ingredients)?.length > 0) && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Ingredients</h4>
                              <div className="flex flex-wrap gap-2">
                                {(result.ingredient_labeling?.ingredients_list || result.ingredients).slice(0, 8).map((ingredient: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                                    {ingredient}
                                  </Badge>
                                ))}
                                {(result.ingredient_labeling?.ingredients_list || result.ingredients).length > 8 && (
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                    +{(result.ingredient_labeling?.ingredients_list || result.ingredients).length - 8} more
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
                                {result.recommendations.slice(0, 3).map((rec: any, index: number) => {
                                  // Handle both old string format and new object format
                                  const recText = typeof rec === 'string' ? rec : rec.recommendation;
                                  const priority = typeof rec === 'object' ? rec.priority : null;

                                  return (
                                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                                      {priority && (
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                          priority === 'critical' ? 'bg-red-100 text-red-800' :
                                          priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                          priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-blue-100 text-blue-800'
                                        }`}>
                                          {priority.toUpperCase()}
                                        </span>
                                      )}
                                      <span className="flex-1">{recText}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          <div className="flex gap-2 pt-4 border-t border-slate-200">
                            <Button
                              onClick={() => router.push(`/analysis/${analysis.id}`)}
                              className="flex-1 gap-2"
                              variant="default"
                            >
                              <Eye className="h-4 w-4" />
                              View Full Report
                            </Button>
                            <Button
                              onClick={() => router.push(`/analysis/${analysis.id}`)}
                              className="gap-2"
                              variant="outline"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
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
                  <p className="text-slate-600 mb-6">Start analyzing labels to see your history here</p>
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
