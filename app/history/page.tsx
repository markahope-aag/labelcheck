'use client';

import { Suspense, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Calendar,
  Download,
  Eye,
  FileText,
  Filter,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clientLogger } from '@/lib/client-logger';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { supabase } from '@/lib/supabase';
import type { Analysis, Recommendation } from '@/types';
import {
  exportAnalysesAsCSV,
  exportAnalysesAsJSON,
  exportAnalysesAsPDF,
} from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 50;
const STORAGE_KEY = 'history_filters';

function HistoryContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name'>('date-desc');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);

  // Delete states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analysisToDelete, setAnalysisToDelete] = useState<Analysis | null>(null);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved);
        if (filters.statusFilter) setStatusFilter(filters.statusFilter);
        if (filters.sortBy) setSortBy(filters.sortBy);
      }
    } catch (error) {
      clientLogger.debug('Failed to load saved filters from localStorage', { error });
    }
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ statusFilter, sortBy }));
    } catch (error) {
      clientLogger.debug('Failed to save filters to localStorage', { error });
    }
  }, [statusFilter, sortBy]);

  // Load data when user changes or filters change
  useEffect(() => {
    loadAnalyses();
  }, [user, currentPage, searchQuery, statusFilter, sortBy, dateRange]);

  // Update URL when filters/page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 0) params.set('page', currentPage.toString());
    if (searchQuery) params.set('search', searchQuery);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sortBy !== 'date-desc') params.set('sort', sortBy);

    const newUrl = params.toString() ? `/history?${params.toString()}` : '/history';
    router.replace(newUrl, { scroll: false });
  }, [currentPage, searchQuery, statusFilter, sortBy]);

  async function loadAnalyses() {
    if (!user) return;

    setPageLoading(true);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', user.id)
        .maybeSingle();

      if (!userData) return;

      // Build query with filters
      let query = supabase
        .from('analyses')
        .select('*', { count: 'exact' })
        .eq('user_id', userData.id);

      // Apply date range filter
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'compliant') {
          // Match both compliance_status field and nested status
          query = query.or(
            'compliance_status.eq.compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.likely_compliant'
          );
        } else if (statusFilter === 'non-compliant') {
          query = query.or(
            'compliance_status.eq.major_violations,analysis_result->overall_assessment->>primary_compliance_status.eq.non_compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.potentially_non_compliant'
          );
        } else {
          query = query.eq('compliance_status', statusFilter);
        }
      }

      // Apply sorting
      if (sortBy === 'date-desc') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'date-asc') {
        query = query.order('created_at', { ascending: true });
      }
      // Note: Name sorting will be done client-side for now as it requires accessing JSON field

      // Apply pagination
      const { data, error, count } = await query.range(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE - 1
      );

      if (error) throw error;

      let results = data || [];

      // Client-side search (for now - could move to DB with proper indexing)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter((analysis) => {
          const result = analysis.analysis_result;
          const labelName = (analysis.label_name || '').toLowerCase();
          const productName = (result.product_name || '').toLowerCase();
          const productType = (result.product_type || '').toLowerCase();
          const summary = (
            result.overall_assessment?.summary ||
            result.summary ||
            ''
          ).toLowerCase();

          return (
            labelName.includes(query) ||
            productName.includes(query) ||
            productType.includes(query) ||
            summary.includes(query)
          );
        });
      }

      // Client-side name sorting
      if (sortBy === 'name') {
        results.sort((a, b) => {
          const nameA = (a.label_name || a.analysis_result.product_name || '').toLowerCase();
          const nameB = (b.label_name || b.analysis_result.product_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }

      setAnalyses(results);
      setTotalCount(count || 0);
    } catch (error) {
      clientLogger.error('Failed to load analyses', { error, currentPage, statusFilter, sortBy });
      toast({
        title: 'Error',
        description: 'Failed to load analysis history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('date-desc');
    setDateRange(undefined);
    setCurrentPage(0);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDeleteDialog(analysis: Analysis) {
    setAnalysisToDelete(analysis);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!analysisToDelete) return;

    try {
      const { error } = await supabase.from('analyses').delete().eq('id', analysisToDelete.id);

      if (error) throw error;

      toast({
        title: 'Analysis Deleted',
        description: 'The analysis has been permanently removed from your history.',
      });

      setDeleteDialogOpen(false);
      setAnalysisToDelete(null);

      // Reload the current page
      loadAnalyses();
    } catch (error) {
      clientLogger.error('Failed to delete analysis', { error, analysisId: analysisToDelete.id });
      toast({
        title: 'Error',
        description: 'Failed to delete analysis. Please try again.',
        variant: 'destructive',
      });
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
      clientLogger.error('Export failed', { error, exportFormat, analysisCount: analyses.length });
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
            {!loading && totalCount > 0 && (
              <div className="flex items-center gap-3">
                <Select
                  value={exportFormat}
                  onValueChange={(value: 'pdf' | 'csv' | 'json') => setExportFormat(value)}
                >
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

          {!loading && (
            <div className="space-y-6">
              {/* Search and Filter Bar */}
              <Card className="border-slate-200">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Row 1: Search, Status, Sort */}
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search by label name, product name, type, or summary..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(0); // Reset to first page on search
                          }}
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

                      <Select
                        value={statusFilter}
                        onValueChange={(value) => {
                          setStatusFilter(value);
                          setCurrentPage(0);
                        }}
                      >
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

                      <Select
                        value={sortBy}
                        onValueChange={(value) => {
                          setSortBy(value as 'name' | 'date-desc' | 'date-asc');
                          setCurrentPage(0);
                        }}
                      >
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

                    {/* Row 2: Date Range + Clear Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <DateRangePicker
                          value={dateRange}
                          onChange={(range) => {
                            setDateRange(range);
                            setCurrentPage(0);
                          }}
                        />
                      </div>
                      <Button variant="outline" onClick={clearFilters} className="gap-2">
                        <X className="h-4 w-4" />
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Results Counter + Loading State */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  {pageLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    <>
                      Showing{' '}
                      <span className="font-semibold text-slate-900">
                        {currentPage * PAGE_SIZE + 1}
                      </span>
                      -
                      <span className="font-semibold text-slate-900">
                        {Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}
                      </span>{' '}
                      of <span className="font-semibold text-slate-900">{totalCount}</span> analysis
                      {totalCount !== 1 ? 'es' : ''}
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {analyses.map((analysis) => {
                  const result = analysis.analysis_result || {};
                  return (
                    <Card
                      key={analysis.id}
                      className="border-slate-200 hover:shadow-lg transition-shadow"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl font-semibold text-slate-900 mb-2">
                              {analysis.label_name || result.product_name || 'Unnamed Product'}
                            </CardTitle>
                            {analysis.label_name &&
                              result.product_name &&
                              analysis.label_name !== result.product_name && (
                                <p className="text-sm text-slate-500 mb-2">
                                  Product: {result.product_name}
                                </p>
                              )}
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
                              <span
                                className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                  result.overall_assessment.primary_compliance_status ===
                                  'compliant'
                                    ? 'bg-green-100 text-green-800 border-green-200 border'
                                    : result.overall_assessment.primary_compliance_status ===
                                        'likely_compliant'
                                      ? 'bg-green-50 text-green-700 border-green-200 border'
                                      : result.overall_assessment.primary_compliance_status ===
                                          'potentially_non_compliant'
                                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200 border'
                                        : 'bg-red-100 text-red-800 border-red-200 border'
                                }`}
                              >
                                {result.overall_assessment.primary_compliance_status
                                  .replace(/_/g, ' ')
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {(result.overall_assessment?.summary || (result as any).summary) && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Summary</h4>
                              <p className="text-slate-600 leading-relaxed">
                                {result.overall_assessment?.summary || (result as any).summary}
                              </p>
                            </div>
                          )}

                          {(
                            result.ingredient_labeling?.ingredients_list ||
                            (result as any).ingredients
                          )?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                Ingredients
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  result.ingredient_labeling?.ingredients_list ||
                                  (result as any).ingredients
                                )
                                  .slice(0, 8)
                                  .map((ingredient: string, index: number) => (
                                    <Badge
                                      key={index}
                                      variant="secondary"
                                      className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    >
                                      {ingredient}
                                    </Badge>
                                  ))}
                                {(
                                  result.ingredient_labeling?.ingredients_list ||
                                  (result as any).ingredients
                                ).length > 8 && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-slate-100 text-slate-700"
                                  >
                                    +
                                    {(
                                      result.ingredient_labeling?.ingredients_list ||
                                      (result as any).ingredients
                                    ).length - 8}{' '}
                                    more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {(result as any).nutrition_facts &&
                            Object.keys((result as any).nutrition_facts).length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                  Key Nutrition Facts
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {Object.entries((result as any).nutrition_facts)
                                    .slice(0, 4)
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                                      >
                                        <p className="text-xs text-slate-600 capitalize mb-1">
                                          {key.replace('_', ' ')}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900">
                                          {value as string}
                                        </p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                          {result.recommendations && result.recommendations.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                Top Recommendations
                              </h4>
                              <ul className="space-y-1">
                                {result.recommendations
                                  .slice(0, 3)
                                  .map((rec: Recommendation, index: number) => {
                                    // Handle both old string format and new object format
                                    const recText =
                                      typeof rec === 'string' ? rec : rec.recommendation;
                                    const priority = typeof rec === 'object' ? rec.priority : null;

                                    return (
                                      <li
                                        key={index}
                                        className="flex items-start gap-2 text-sm text-slate-600"
                                      >
                                        {priority && (
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                              priority === 'critical'
                                                ? 'bg-red-100 text-red-800'
                                                : priority === 'high'
                                                  ? 'bg-orange-100 text-orange-800'
                                                  : priority === 'medium'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-blue-100 text-blue-800'
                                            }`}
                                          >
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
                            <Button
                              onClick={() => openDeleteDialog(analysis)}
                              className="gap-2"
                              variant="outline"
                              title="Delete analysis"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalCount > PAGE_SIZE && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => currentPage > 0 && handlePageChange(currentPage - 1)}
                          className={
                            currentPage === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>

                      {/* Page Numbers */}
                      {(() => {
                        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
                        const pages: (number | string)[] = [];

                        if (totalPages <= 7) {
                          // Show all pages if 7 or fewer
                          for (let i = 0; i < totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Show first page, current range, and last page with ellipsis
                          if (currentPage <= 3) {
                            for (let i = 0; i < 5; i++) pages.push(i);
                            pages.push('ellipsis');
                            pages.push(totalPages - 1);
                          } else if (currentPage >= totalPages - 4) {
                            pages.push(0);
                            pages.push('ellipsis');
                            for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
                          } else {
                            pages.push(0);
                            pages.push('ellipsis');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                            pages.push('ellipsis');
                            pages.push(totalPages - 1);
                          }
                        }

                        return pages.map((page, idx) =>
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => handlePageChange(page as number)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {(page as number) + 1}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        );
                      })()}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            currentPage < Math.ceil(totalCount / PAGE_SIZE) - 1 &&
                            handlePageChange(currentPage + 1)
                          }
                          className={
                            currentPage >= Math.ceil(totalCount / PAGE_SIZE) - 1
                              ? 'pointer-events-none opacity-50'
                              : 'cursor-pointer'
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!loading && analyses.length === 0 && (
            <Card className="border-slate-200">
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="bg-slate-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Search className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No analyses yet</h3>
                  <p className="text-slate-600 mb-6">
                    Start analyzing labels to see your history here
                  </p>
                  <a
                    href="/analyze"
                    className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Analyze Your First Label
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the analysis for "
                  {analysisToDelete?.analysis_result?.product_name || 'this product'}"?
                  <br />
                  <br />
                  <span className="font-semibold text-slate-900">
                    This action cannot be undone.
                  </span>{' '}
                  The analysis will be permanently removed from your history.
                  <br />
                  <br />
                  <span className="text-sm text-slate-600">
                    Note: Deleting this analysis does not refund your usage quota. You paid for the
                    analysis, not storage.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  Delete Analysis
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
