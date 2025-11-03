'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { clientLogger } from '@/lib/client-logger';
import {
  Camera,
  Upload,
  Loader2,
  AlertCircle,
  Download,
  Share2,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { exportSingleAnalysisAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useAnalysisSession } from '@/hooks/useAnalysisSession';
import { AnalysisChat } from '@/components/AnalysisChat';
import { TextChecker } from '@/components/TextChecker';
import { PrintReadyCertification } from '@/components/PrintReadyCertification';
import { AnalysisUploadForm } from '@/components/AnalysisUploadForm';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { ComplianceSummaryTable } from '@/components/ComplianceSummaryTable';
import CategorySelector from '@/components/CategorySelector';
import CategoryComparison from '@/components/CategoryComparison';
import { ImageQualityWarning } from '@/components/ImageQualityWarning';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ProductCategory } from '@/lib/supabase';
import type { ImageQualityMetrics } from '@/lib/image-quality';
import type {
  AnalysisResult,
  Recommendation,
  LabelingSection,
  AnalyzeImageResponse,
  APIError,
  ComplianceTableRow,
  OtherRequirement,
  IngredientMatch,
  CreateShareLinkResponse,
} from '@/types';

// Helper function to format compliance status for display
const formatComplianceStatus = (status: string): string => {
  if (!status) return '';

  // Handle specific cases
  const statusMap: Record<string, string> = {
    compliant: 'Compliant',
    likely_compliant: 'Likely Compliant',
    non_compliant: 'Non-Compliant',
    potentially_non_compliant: 'Potentially-Non-Compliant',
    not_applicable: 'Not Applicable',
    warning: 'Warning',
  };

  return (
    statusMap[status] ||
    status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-')
  );
};

export default function AnalyzePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Custom hooks for business logic
  const fileUpload = useFileUpload();
  const analysis = useAnalysis({ userId });
  const session = useAnalysisSession();

  // Local UI state
  const [labelName, setLabelName] = useState<string>('');

  // File upload and analysis handlers are now in custom hooks (useFileUpload, useAnalysis)

  const handleReset = () => {
    fileUpload.resetFile();
    analysis.reset();
    session.closeComparison();
    setLabelName(''); // Clear label name (local UI state)
  };

  const handleCategorySelect = async (category: ProductCategory, reason?: string) => {
    if (!analysis.analysisData || !fileUpload.selectedFile) return;

    // If user selects the same category that was already detected, just show results
    if (category === analysis.analysisData.product_category) {
      analysis.setResult(analysis.analysisData);
      analysis.hideCategorySelectorUI();
      session.closeComparison();
      return;
    }

    // User selected a different category - need to re-analyze with forced category
    try {
      analysis.setAnalyzingState(true);
      analysis.setErrorState('');

      const formData = new FormData();
      formData.append('image', fileUpload.selectedFile);
      formData.append('forcedCategory', category);

      if (analysis.sessionId) {
        formData.append('analysis.sessionId', analysis.sessionId);
      }
      if (labelName) {
        formData.append('labelName', labelName);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data: AnalyzeImageResponse | APIError = await response.json();

      if (!response.ok) {
        const errorData = data as APIError;
        throw new Error(errorData.error || 'Analysis failed');
      }

      const responseData = data as AnalyzeImageResponse;

      // Save the user's category selection and reason to the database
      if (responseData.id) {
        try {
          await fetch('/api/analyze/select-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              analysisId: responseData.id,
              selectedCategory: category,
              selectionReason: reason || null,
            }),
          });
        } catch (error) {
          clientLogger.error('Failed to save category selection', {
            error,
            analysisId: responseData.id,
            category,
          });
          // Continue anyway - don't block user from seeing results
        }
      }

      // Show the new analysis results
      analysis.setResult(responseData);
      analysis.hideCategorySelectorUI();
      analysis.updateAnalysisData(responseData);
      session.closeComparison();

      toast({
        title: 'Re-analysis Complete',
        description: `Label analyzed using ${category.replace(/_/g, ' ')} category rules`,
      });
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error('Failed to re-analyze with selected category');
      analysis.setErrorState(error.message);
      clientLogger.error('Category re-analysis failed', { error, category });
      toast({
        title: 'Re-analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      analysis.setAnalyzingState(false);
    }
  };

  const handleChangeCategoryClick = () => {
    // Go back to category selector to try a different classification
    analysis.showCategorySelectorUI();
    session.closeComparison();
  };

  const handleCompare = () => {
    session.openComparison();
    analysis.hideCategorySelectorUI();
  };

  const handleBackToSelector = () => {
    session.closeComparison();
    analysis.showCategorySelectorUI();
  };

  const handleDownloadPDF = async () => {
    if (!analysis.result) return;

    try {
      // Transform AnalyzeImageResponse to AnalysisData format expected by export function
      await exportSingleAnalysisAsPDF({
        id: analysis.result.id,
        image_name: analysis.result.image_name,
        analysis_result: analysis.result,
        compliance_status: analysis.result.compliance_status,
        issues_found: analysis.result.issues_found,
        created_at: analysis.result.created_at,
      } as Parameters<typeof exportSingleAnalysisAsPDF>[0]);
      toast({
        title: 'Success',
        description: 'Compliance report downloaded successfully',
      });
    } catch (error) {
      clientLogger.error('PDF download failed', { error, analysisId: analysis.result.id });
      toast({
        title: 'Error',
        description: 'Failed to download PDF report',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!analysis.result?.id) return;
    await session.openShareDialog(analysis.result.id);
  };

  const handleCopyLink = () => {
    session.copyShareUrl();
  };

  const handleTextAnalysisComplete = (analysisResult: AnalysisResult) => {
    // Update the result state with the text analysis
    analysis.setResult({
      ...analysisResult,
      id: '',
      image_name: 'Text Content Analysis',
      compliance_status: '',
      issues_found: 0,
      created_at: new Date().toISOString(),
    } as unknown as AnalyzeImageResponse);

    toast({
      title: 'Text Analysis Complete',
      description: 'Your prospective label content has been analyzed',
    });
  };

  const handleUploadRevised = () => {
    // Enter revised mode (stores current result for comparison)
    analysis.enterRevisedMode();

    // Clear current file to show upload UI
    fileUpload.resetFile();
    analysis.setResult(null);

    toast({
      title: 'Upload Revised Label',
      description: 'Upload your updated label to see the improvements',
    });
  };

  // Calculate comparison between previous and current results
  const calculateComparison = () => {
    if (!analysis.previousResult || !analysis.result) return null;

    const prevStatus = analysis.previousResult.overall_assessment?.primary_compliance_status || '';
    const currStatus = analysis.result.overall_assessment?.primary_compliance_status || '';

    // Count issues by severity in previous result
    const prevIssues = {
      critical: 0,
      warning: 0,
      compliant: 0,
    };

    // Count issues by severity in current result
    const currIssues = {
      critical: 0,
      warning: 0,
      compliant: 0,
    };

    // Helper to count issues from a section
    const countIssuesInSection = (
      section: LabelingSection | Record<string, LabelingSection | undefined> | undefined,
      counters: { critical: number; warning: number; compliant: number }
    ) => {
      if (!section) return;

      // Handle direct LabelingSection
      if ('status' in section && typeof section === 'object' && !Array.isArray(section)) {
        const status = (section as LabelingSection).status;
        if (status === 'non_compliant') counters.critical++;
        else if (status === 'potentially_non_compliant') counters.warning++;
        else if (status === 'compliant') counters.compliant++;
      } else if (typeof section === 'object') {
        // Handle Record<string, LabelingSection | undefined>
        Object.values(section).forEach((item) => {
          if (item && item.status) {
            if (item.status === 'non_compliant') counters.critical++;
            else if (item.status === 'potentially_non_compliant') counters.warning++;
            else if (item.status === 'compliant') counters.compliant++;
          }
        });
      }
    };

    // Count issues in both results
    [analysis.previousResult, analysis.result].forEach((res, idx) => {
      const counters = idx === 0 ? prevIssues : currIssues;
      // Count from general_labeling (which is an object with sub-sections)
      if (res?.general_labeling) {
        Object.values(res.general_labeling).forEach((section: any) => {
          if (section && section.status) {
            if (section.status === 'non_compliant') counters.critical++;
            else if (section.status === 'potentially_non_compliant') counters.warning++;
            else if (section.status === 'compliant') counters.compliant++;
          }
        });
      }
      // Count from nutrition_labeling (optional)
      if (res.nutrition_labeling && res.nutrition_labeling.status) {
        if (res.nutrition_labeling.status === 'non_compliant') counters.critical++;
        else if (res.nutrition_labeling.status === 'potentially_non_compliant') counters.warning++;
        else if (res.nutrition_labeling.status === 'compliant') counters.compliant++;
      }
      // Count from allergen_labeling
      if (res.allergen_labeling && res.allergen_labeling.status) {
        if (res.allergen_labeling.status === 'non_compliant') counters.critical++;
        else if (res.allergen_labeling.status === 'potentially_non_compliant') counters.warning++;
        else if (res.allergen_labeling.status === 'compliant') counters.compliant++;
      }
      // Claims are structured differently, skip for now
    });

    const prevTotal = prevIssues.critical + prevIssues.warning;
    const currTotal = currIssues.critical + currIssues.warning;
    const improvement = prevTotal - currTotal;

    return {
      prevStatus,
      currStatus,
      prevIssues: prevTotal,
      currIssues: currTotal,
      improvement,
      statusImproved:
        prevStatus !== currStatus &&
        (currStatus === 'compliant' || currStatus === 'likely_compliant'),
    };
  };

  const comparison = analysis.previousResult && analysis.result ? calculateComparison() : null;

  useEffect(() => {
    if (userId === null) {
      router.push('/sign-in');
    }
  }, [userId, router]);

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Analyze Label</h1>
            <p className="text-slate-600">Upload any label to get instant compliance insights</p>
          </div>

          {analysis.error && (
            <ErrorAlert
              message={analysis.error}
              code={analysis.errorCode}
              variant={analysis.errorCode === 'RATE_LIMIT' ? 'warning' : 'destructive'}
            />
          )}

          {session.showComparison && analysis.analysisData ? (
            // Show Category Comparison when user clicks "Compare All Options Side-by-Side"
            <CategoryComparison
              aiCategory={analysis.analysisData.product_category}
              confidence={analysis.analysisData.category_confidence || 'medium'}
              categoryRationale={analysis.analysisData.category_rationale || ''}
              alternatives={analysis.analysisData.category_ambiguity?.alternative_categories || []}
              categoryOptions={analysis.analysisData.category_ambiguity?.category_options || {}}
              labelConflicts={(analysis.analysisData.category_ambiguity?.label_conflicts || []).map(
                (conflict) => ({
                  conflict: conflict as string,
                  current_category: analysis.analysisData?.product_category || '',
                  violation: conflict as string,
                  severity: 'medium' as const,
                })
              )}
              recommendation={analysis.analysisData.category_ambiguity?.recommendation}
              onSelect={handleCategorySelect}
              onBack={handleBackToSelector}
            />
          ) : analysis.showCategorySelector && analysis.analysisData ? (
            // Show Category Selector when ambiguity is detected
            <CategorySelector
              aiCategory={analysis.analysisData.product_category}
              confidence={analysis.analysisData.category_confidence || 'medium'}
              categoryRationale={analysis.analysisData.category_rationale || ''}
              alternatives={analysis.analysisData.category_ambiguity?.alternative_categories || []}
              categoryOptions={analysis.analysisData.category_ambiguity?.category_options || {}}
              labelConflicts={(analysis.analysisData.category_ambiguity?.label_conflicts || []).map(
                (conflict) => ({
                  conflict: conflict as string,
                  current_category: analysis.analysisData?.product_category || '',
                  violation: conflict as string,
                  severity: 'medium' as const,
                })
              )}
              recommendation={analysis.analysisData.category_ambiguity?.recommendation}
              onSelect={handleCategorySelect}
              onCompare={handleCompare}
            />
          ) : !analysis.result || analysis.isRevisedMode ? (
            <>
              {analysis.isRevisedMode && analysis.previousResult && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-purple-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900">Revision Mode Active</h3>
                      <p className="text-sm text-purple-700">
                        Upload your revised label to see how your changes compare to the previous
                        analysis
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <AnalysisUploadForm
                selectedFile={fileUpload.selectedFile}
                previewUrl={fileUpload.previewUrl}
                isDragging={fileUpload.isDragging}
                imageQuality={fileUpload.imageQuality}
                showQualityWarning={fileUpload.showQualityWarning}
                isRevisedMode={analysis.isRevisedMode}
                isAnalyzing={analysis.isAnalyzing}
                analysisStep={analysis.analysisStep}
                analysisProgress={analysis.analysisProgress}
                labelName={labelName}
                onLabelNameChange={setLabelName}
                onDragEnter={fileUpload.handleDragEnter}
                onDragLeave={fileUpload.handleDragLeave}
                onDragOver={fileUpload.handleDragOver}
                onDrop={fileUpload.handleDrop}
                onFileSelect={fileUpload.handleFileSelect}
                onDismissQualityWarning={fileUpload.dismissQualityWarning}
                onReupload={fileUpload.resetFile}
                onAnalyze={() => {
                  if (fileUpload.selectedFile) {
                    analysis.analyzeLabel(fileUpload.selectedFile, labelName);
                  }
                }}
                onReset={handleReset}
              />
            </>
          ) : (
            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl font-semibold text-slate-900">
                          {analysis.result.product_name || 'Analysis Results'}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {analysis.result.product_type || 'Regulatory Compliance Analysis'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {/* Show "Change Category" button if this result came from category selection */}
                        {analysis.analysisData &&
                          (analysis.analysisData.category_ambiguity?.alternative_categories
                            ?.length ?? 0) > 0 && (
                            <Button
                              onClick={handleChangeCategoryClick}
                              variant="outline"
                              className="border-orange-400 text-orange-700 hover:bg-orange-50 gap-2"
                            >
                              <AlertCircle className="h-4 w-4" />
                              Change Category
                            </Button>
                          )}
                        <Button
                          onClick={handleShare}
                          variant="outline"
                          className="border-slate-300 hover:bg-slate-50 gap-2"
                        >
                          <Share2 className="h-4 w-4" />
                          Share
                        </Button>
                        <Button
                          onClick={handleDownloadPDF}
                          variant="outline"
                          className="border-slate-300 hover:bg-slate-50 gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download PDF
                        </Button>
                        <Button
                          onClick={handleReset}
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          New Analysis
                        </Button>
                      </div>
                    </div>
                    {/* Regulatory Framework Badge - moved to separate row */}
                    {analysis.result.product_type && (
                      <div>
                        {analysis.result.product_type === 'DIETARY_SUPPLEMENT' ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
                            <svg
                              className="h-4 w-4 text-purple-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-sm font-medium text-purple-900">
                              Analyzed as Dietary Supplement (DSHEA regulations apply)
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md">
                            <svg
                              className="h-4 w-4 text-green-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-sm font-medium text-green-900">
                              Analyzed as Food/Beverage Product (FDA food labeling regulations
                              apply)
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Session Context */}
                    {analysis.sessionId && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-blue-600"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-blue-900">Analysis Session Active</h3>
                            <p className="text-sm text-blue-700">
                              You can now iterate on this analysis to improve compliance
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <button
                            onClick={() => session.openChat()}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
                          >
                            <div className="p-2 bg-blue-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-blue-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Ask AI Questions</div>
                              <div className="text-xs text-slate-600">Get expert help</div>
                            </div>
                          </button>

                          <button
                            onClick={() => session.openTextChecker()}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all"
                          >
                            <div className="p-2 bg-green-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">
                                Check Text Alternative
                              </div>
                              <div className="text-xs text-slate-600">Test revised content</div>
                            </div>
                          </button>

                          <button
                            onClick={handleUploadRevised}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                          >
                            <div className="p-2 bg-purple-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-purple-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">
                                Upload Revised Label
                              </div>
                              <div className="text-xs text-slate-600">Test your improvements</div>
                            </div>
                          </button>
                        </div>

                        <div className="mt-4 p-3 bg-blue-100 bg-opacity-50 rounded-lg">
                          <p className="text-xs text-blue-800">
                            <strong>Session ID:</strong>{' '}
                            <code className="font-mono text-xs">
                              {analysis.sessionId.substring(0, 8)}...
                            </code>{' '}
                            • This session maintains context across multiple iterations
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Comparison Results */}
                    {comparison && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 text-purple-600"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-purple-900">
                              Revision Comparison
                            </h3>
                            <p className="text-sm text-purple-700">
                              See how your changes improved compliance
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Previous Issues */}
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <div className="text-sm font-semibold text-slate-600 mb-1">
                              Previous Analysis
                            </div>
                            <div className="text-3xl font-bold text-slate-900">
                              {comparison.prevIssues}
                            </div>
                            <div className="text-sm text-slate-600">issues found</div>
                          </div>

                          {/* Improvement */}
                          <div className="bg-white rounded-lg p-4 border-2 border-purple-300 flex items-center justify-center">
                            <div className="text-center">
                              {comparison.improvement > 0 ? (
                                <>
                                  <div className="text-4xl font-bold text-green-600">
                                    ↓ {comparison.improvement}
                                  </div>
                                  <div className="text-sm font-semibold text-green-700 mt-1">
                                    Issues Resolved
                                  </div>
                                </>
                              ) : comparison.improvement < 0 ? (
                                <>
                                  <div className="text-4xl font-bold text-red-600">
                                    ↑ {Math.abs(comparison.improvement)}
                                  </div>
                                  <div className="text-sm font-semibold text-red-700 mt-1">
                                    New Issues
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-4xl font-bold text-yellow-600">=</div>
                                  <div className="text-sm font-semibold text-yellow-700 mt-1">
                                    No Change
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Current Issues */}
                          <div
                            className={`rounded-lg p-4 border-2 ${
                              comparison.currIssues === 0
                                ? 'bg-green-50 border-green-300'
                                : 'bg-white border-purple-200'
                            }`}
                          >
                            <div className="text-sm font-semibold text-slate-600 mb-1">
                              Current Analysis
                            </div>
                            <div
                              className={`text-3xl font-bold ${
                                comparison.currIssues === 0 ? 'text-green-600' : 'text-slate-900'
                              }`}
                            >
                              {comparison.currIssues}
                            </div>
                            <div
                              className={`text-sm ${
                                comparison.currIssues === 0
                                  ? 'text-green-700 font-semibold'
                                  : 'text-slate-600'
                              }`}
                            >
                              {comparison.currIssues === 0
                                ? '✓ Fully Compliant!'
                                : 'issues remaining'}
                            </div>
                          </div>
                        </div>

                        {comparison.statusImproved && (
                          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-semibold text-green-800">
                                Compliance status improved! Your revisions made a positive impact.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Print-Ready Certification */}
                    {analysis.result.recommendations && (
                      <PrintReadyCertification
                        criticalCount={
                          analysis.result.recommendations.filter(
                            (r: Recommendation) => r.priority === 'critical'
                          ).length
                        }
                        highCount={
                          analysis.result.recommendations.filter(
                            (r: Recommendation) => r.priority === 'high'
                          ).length
                        }
                        mediumCount={
                          analysis.result.recommendations.filter(
                            (r: Recommendation) => r.priority === 'medium'
                          ).length
                        }
                        lowCount={
                          analysis.result.recommendations.filter(
                            (r: Recommendation) => r.priority === 'low'
                          ).length
                        }
                        analysisDate={analysis.result.created_at || new Date().toISOString()}
                        criticalIssues={analysis.result.recommendations.filter(
                          (r: Recommendation) => r.priority === 'critical'
                        )}
                        highIssues={analysis.result.recommendations.filter(
                          (r: Recommendation) => r.priority === 'high'
                        )}
                      />
                    )}

                    {/* Overall Assessment */}
                    {analysis.result.overall_assessment && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-blue-900 mb-2">
                              Overall Compliance Status
                            </h3>
                            <div className="mb-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                  analysis.result.overall_assessment.primary_compliance_status ===
                                  'compliant'
                                    ? 'bg-green-100 text-green-800'
                                    : analysis.result.overall_assessment
                                          .primary_compliance_status === 'likely_compliant'
                                      ? 'bg-green-50 text-green-700'
                                      : analysis.result.overall_assessment
                                            .primary_compliance_status ===
                                          'potentially_non_compliant'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {formatComplianceStatus(
                                  analysis.result.overall_assessment.primary_compliance_status
                                )}
                              </span>
                              <span className="ml-3 text-sm text-blue-700">
                                Confidence: {analysis.result.overall_assessment.confidence_level}
                              </span>
                            </div>
                            <p className="text-blue-800 leading-relaxed mb-3">
                              {analysis.result.overall_assessment.summary}
                            </p>
                            {analysis.result.overall_assessment.key_findings &&
                              analysis.result.overall_assessment.key_findings.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-blue-900 mb-2">
                                    Key Findings:
                                  </h4>
                                  <ul className="space-y-1">
                                    {analysis.result.overall_assessment.key_findings.map(
                                      (finding: string, idx: number) => (
                                        <li key={idx} className="text-sm text-blue-800">
                                          • {finding}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* General Labeling Requirements */}
                    {analysis.result.general_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          1. General Labeling Requirements
                        </h3>
                        <div className="space-y-4">
                          {analysis.result.general_labeling.statement_of_identity && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">
                                  Statement of Identity
                                </h4>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    analysis.result.general_labeling.statement_of_identity
                                      .status === 'compliant'
                                      ? 'bg-green-100 text-green-800'
                                      : analysis.result.general_labeling.statement_of_identity
                                            .status === 'non_compliant'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {formatComplianceStatus(
                                    analysis.result.general_labeling.statement_of_identity.status
                                  )}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">
                                {analysis.result.general_labeling.statement_of_identity.details}
                              </p>
                              <p className="text-xs text-slate-500">
                                {
                                  analysis.result.general_labeling.statement_of_identity
                                    .regulation_citation
                                }
                              </p>
                            </div>
                          )}
                          {analysis.result.general_labeling.net_quantity && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">
                                  Net Quantity of Contents
                                </h4>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    analysis.result.general_labeling.net_quantity.status ===
                                    'compliant'
                                      ? 'bg-green-100 text-green-800'
                                      : analysis.result.general_labeling.net_quantity.status ===
                                          'non_compliant'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {formatComplianceStatus(
                                    analysis.result.general_labeling.net_quantity.status
                                  )}
                                </span>
                              </div>
                              {analysis.result.general_labeling.net_quantity.value_found && (
                                <div className="bg-white border border-slate-200 rounded px-3 py-2 mb-3">
                                  <span className="text-xs font-semibold text-slate-600 uppercase">
                                    Found on Label:
                                  </span>
                                  <p className="text-sm font-medium text-slate-900 mt-1">
                                    {analysis.result.general_labeling.net_quantity.value_found}
                                  </p>
                                </div>
                              )}
                              <p className="text-sm text-slate-700 mb-2">
                                {analysis.result.general_labeling.net_quantity.details}
                              </p>
                              <p className="text-xs text-slate-500">
                                {analysis.result.general_labeling.net_quantity.regulation_citation}
                              </p>
                            </div>
                          )}
                          {analysis.result.general_labeling.manufacturer_address && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">
                                  Manufacturer/Distributor Address
                                </h4>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    analysis.result.general_labeling.manufacturer_address.status ===
                                    'compliant'
                                      ? 'bg-green-100 text-green-800'
                                      : analysis.result.general_labeling.manufacturer_address
                                            .status === 'non_compliant'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {formatComplianceStatus(
                                    analysis.result.general_labeling.manufacturer_address.status
                                  )}
                                </span>
                              </div>
                              {analysis.result.general_labeling.manufacturer_address
                                .address_found && (
                                <div className="bg-white border border-slate-200 rounded px-3 py-2 mb-3">
                                  <span className="text-xs font-semibold text-slate-600 uppercase">
                                    Found on Label:
                                  </span>
                                  <p className="text-sm font-medium text-slate-900 mt-1">
                                    {
                                      analysis.result.general_labeling.manufacturer_address
                                        .address_found
                                    }
                                  </p>
                                </div>
                              )}
                              <p className="text-sm text-slate-700 mb-2">
                                {analysis.result.general_labeling.manufacturer_address.details}
                              </p>
                              <p className="text-xs text-slate-500">
                                {
                                  analysis.result.general_labeling.manufacturer_address
                                    .regulation_citation
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ingredient Labeling */}
                    {analysis.result.ingredient_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          2. Ingredient Labeling
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Ingredient Declaration</h4>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                analysis.result.ingredient_labeling.status === 'compliant'
                                  ? 'bg-green-100 text-green-800'
                                  : analysis.result.ingredient_labeling.status === 'non_compliant'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {formatComplianceStatus(analysis.result.ingredient_labeling.status)}
                            </span>
                          </div>
                          {analysis.result.ingredient_labeling.ingredients_list &&
                            analysis.result.ingredient_labeling.ingredients_list.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-slate-600 mb-2">
                                  Ingredients:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.result.ingredient_labeling.ingredients_list.map(
                                    (ingredient: string, idx: number) => {
                                      // Find GRAS status for this ingredient
                                      const grasStatus =
                                        analysis.result?.gras_compliance?.gras_ingredients?.find(
                                          (r: IngredientMatch) => r.ingredient === ingredient
                                        );
                                      const isGRAS = grasStatus?.is_gras;

                                      return (
                                        <span
                                          key={idx}
                                          className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 cursor-help transition-transform hover:scale-105 ${
                                            isGRAS === true
                                              ? 'bg-green-50 text-green-800 border-green-300'
                                              : isGRAS === false
                                                ? 'bg-red-50 text-red-800 border-red-300'
                                                : 'bg-slate-50 text-slate-700 border-slate-300'
                                          }`}
                                          title={
                                            isGRAS === true
                                              ? `✓ GRAS Compliant${grasStatus?.match_type ? ` (${grasStatus.match_type} match)` : ' (match type unknown)'}`
                                              : isGRAS === false
                                                ? `✗ Not in GRAS database`
                                                : 'GRAS status unknown'
                                          }
                                        >
                                          {ingredient}
                                        </span>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.result.ingredient_labeling.details}
                          </p>
                          <p className="text-xs text-slate-500">
                            {analysis.result.ingredient_labeling.regulation_citation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Allergen Labeling */}
                    {analysis.result.allergen_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          3. Food Allergen Labeling (FALCPA/FASTER Act)
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">
                              Allergen Declaration Compliance
                            </h4>
                            <div className="flex gap-2 items-center">
                              {analysis.result.allergen_labeling.risk_level &&
                                analysis.result.allergen_labeling.status !== 'not_applicable' &&
                                analysis.result.allergen_labeling.status !== 'compliant' && (
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                      analysis.result.allergen_labeling.risk_level === 'high'
                                        ? 'bg-red-200 text-red-900'
                                        : analysis.result.allergen_labeling.risk_level === 'medium'
                                          ? 'bg-yellow-200 text-yellow-900'
                                          : 'bg-green-200 text-green-900'
                                    }`}
                                  >
                                    Risk: {analysis.result.allergen_labeling.risk_level}
                                  </span>
                                )}
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  analysis.result.allergen_labeling.status === 'compliant'
                                    ? 'bg-green-100 text-green-800'
                                    : analysis.result.allergen_labeling.status ===
                                        'potentially_non_compliant'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {formatComplianceStatus(analysis.result.allergen_labeling.status)}
                              </span>
                            </div>
                          </div>
                          {analysis.result.allergen_labeling.potential_allergens &&
                            analysis.result.allergen_labeling.potential_allergens.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-slate-700 mb-1">
                                  Potential Allergen-Containing Ingredients:
                                </p>
                                <ul className="text-sm text-slate-800 space-y-1">
                                  {analysis.result.allergen_labeling.potential_allergens.map(
                                    (allergen: string, idx: number) => (
                                      <li key={idx}>• {allergen}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          <p className="text-sm text-slate-800 mb-2">
                            {analysis.result.allergen_labeling.details}
                          </p>
                          <p className="text-xs text-slate-600">
                            {analysis.result.allergen_labeling.regulation_citation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Nutrition Labeling */}
                    {analysis.result.nutrition_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          4. Nutrition Labeling
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Nutrition Facts Panel</h4>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                analysis.result.nutrition_labeling.status === 'compliant'
                                  ? 'bg-green-100 text-green-800'
                                  : analysis.result.nutrition_labeling.status === 'non_compliant'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {formatComplianceStatus(analysis.result.nutrition_labeling.status)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Panel Present:</span>
                              <span className="ml-2 text-slate-600">
                                {analysis.result.nutrition_labeling.panel_present ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">
                                Exemption Applicable:
                              </span>
                              <span className="ml-2 text-slate-600">
                                {analysis.result.nutrition_labeling.exemption_applicable
                                  ? 'Yes'
                                  : 'No'}
                              </span>
                            </div>
                          </div>
                          {analysis.result.nutrition_labeling.exemption_reason && (
                            <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded">
                              <p className="text-xs font-semibold text-slate-700 mb-1">
                                Exemption Reason:
                              </p>
                              <p className="text-sm text-slate-800">
                                {analysis.result.nutrition_labeling.exemption_reason}
                              </p>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.result.nutrition_labeling.details}
                          </p>
                          <p className="text-xs text-slate-500">
                            {analysis.result.nutrition_labeling.regulation_citation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Supplement Facts Panel (for supplements) */}
                    {analysis.result.supplement_facts_panel && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          4. Supplement Facts Panel
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">
                              Supplement Facts Panel Compliance
                            </h4>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                analysis.result.supplement_facts_panel.status === 'compliant'
                                  ? 'bg-green-100 text-green-800'
                                  : analysis.result.supplement_facts_panel.status ===
                                      'non_compliant'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {formatComplianceStatus(
                                analysis.result.supplement_facts_panel.status
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Panel Present:</span>
                              <span className="ml-2 text-slate-600">
                                {analysis.result.supplement_facts_panel.panel_present
                                  ? 'Yes'
                                  : 'No'}
                              </span>
                            </div>
                            {analysis.result.supplement_facts_panel.wrong_panel_type !==
                              undefined && (
                              <div>
                                <span className="font-semibold text-slate-700">
                                  Wrong Panel Type:
                                </span>
                                <span className="ml-2 text-slate-600">
                                  {analysis.result.supplement_facts_panel.wrong_panel_type
                                    ? 'Yes'
                                    : 'No'}
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-2">
                            {analysis.result.supplement_facts_panel.details}
                          </p>
                          <p className="text-xs text-slate-500">
                            {analysis.result.supplement_facts_panel.regulation_citation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Claims */}
                    {analysis.result.claims && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          5. Claims
                        </h3>
                        <div className="space-y-4">
                          {/* Structure/Function Claims */}
                          {analysis.result.claims.structure_function_claims?.claims_present &&
                            analysis.result.claims.structure_function_claims.claims_found.length >
                              0 && (
                              <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-slate-900">
                                    Structure/Function Claims
                                  </h4>
                                  {analysis.result.claims.structure_function_claims.status && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        analysis.result.claims.structure_function_claims.status ===
                                        'compliant'
                                          ? 'bg-green-100 text-green-800'
                                          : analysis.result.claims.structure_function_claims
                                                .status === 'non_compliant'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {formatComplianceStatus(
                                        analysis.result.claims.structure_function_claims.status
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {analysis.result.claims.structure_function_claims.claims_found.map(
                                    (claim, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-white border border-slate-200 rounded"
                                      >
                                        <div className="text-sm text-slate-900 mb-1">
                                          {claim.claim_text}
                                        </div>
                                        {claim.compliance_issue && (
                                          <div className="text-xs text-red-700 mt-1">
                                            ⚠️ {claim.compliance_issue}
                                          </div>
                                        )}
                                        {claim.disclaimer_required && !claim.disclaimer_present && (
                                          <div className="text-xs text-yellow-700 mt-1">
                                            ⚠️ Disclaimer required but not found
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Nutrient Content Claims */}
                          {analysis.result.claims.nutrient_content_claims?.claims_present &&
                            analysis.result.claims.nutrient_content_claims.claims_found.length >
                              0 && (
                              <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-slate-900">
                                    Nutrient Content Claims
                                  </h4>
                                  {analysis.result.claims.nutrient_content_claims.status && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        analysis.result.claims.nutrient_content_claims.status ===
                                        'compliant'
                                          ? 'bg-green-100 text-green-800'
                                          : analysis.result.claims.nutrient_content_claims
                                                .status === 'non_compliant'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {formatComplianceStatus(
                                        analysis.result.claims.nutrient_content_claims.status
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {analysis.result.claims.nutrient_content_claims.claims_found.map(
                                    (claim, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-white border border-slate-200 rounded"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="text-sm text-slate-900 mb-1">
                                            {claim.claim_text}
                                          </div>
                                          <span
                                            className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                                              claim.meets_definition
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}
                                          >
                                            {claim.meets_definition
                                              ? 'Meets Definition'
                                              : 'Does Not Meet Definition'}
                                          </span>
                                        </div>
                                        {claim.issue && (
                                          <div className="text-xs text-red-700 mt-1">
                                            ⚠️ {claim.issue}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Health Claims */}
                          {analysis.result.claims.health_claims?.claims_present &&
                            analysis.result.claims.health_claims.claims_found.length > 0 && (
                              <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-slate-900">Health Claims</h4>
                                  {analysis.result.claims.health_claims.status && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        analysis.result.claims.health_claims.status === 'compliant'
                                          ? 'bg-green-100 text-green-800'
                                          : analysis.result.claims.health_claims.status ===
                                              'non_compliant'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {formatComplianceStatus(
                                        analysis.result.claims.health_claims.status
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {analysis.result.claims.health_claims.claims_found.map(
                                    (claim, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-white border border-slate-200 rounded"
                                      >
                                        <div className="text-sm text-slate-900">
                                          {claim.claim_text}
                                        </div>
                                        {claim.issue && (
                                          <div className="text-xs text-red-700 mt-1">
                                            ⚠️ {claim.issue}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Prohibited Claims */}
                          {analysis.result.claims.prohibited_claims?.claims_present &&
                            analysis.result.claims.prohibited_claims.claims_found.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-4 border-2 border-red-300">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-red-900">
                                    ⚠️ Prohibited Claims Detected
                                  </h4>
                                  {analysis.result.claims.prohibited_claims.status && (
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-red-200 text-red-900">
                                      {formatComplianceStatus(
                                        analysis.result.claims.prohibited_claims.status
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {analysis.result.claims.prohibited_claims.claims_found.map(
                                    (claim, idx: number) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-white border border-red-300 rounded"
                                      >
                                        <div className="text-sm text-red-900">
                                          {claim.claim_text}
                                        </div>
                                        {claim.issue && (
                                          <div className="text-xs text-red-700 mt-1">
                                            ⚠️ {claim.issue}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Overall Claims Details */}
                          {analysis.result.claims.details && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <h4 className="font-semibold text-slate-900 mb-2">
                                Overall Claims Assessment
                              </h4>
                              <p className="text-sm text-slate-700 mb-2">
                                {analysis.result.claims.details}
                              </p>
                              {analysis.result.claims.regulation_citation && (
                                <p className="text-xs text-slate-500">
                                  {analysis.result.claims.regulation_citation}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Additional Requirements */}
                    {analysis.result.additional_requirements && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          6. Additional Regulatory Requirements
                        </h3>
                        <div className="space-y-3">
                          {/* Only show fortification for conventional foods/beverages, NOT dietary supplements */}
                          {analysis.result.additional_requirements.fortification &&
                            analysis.result.additional_requirements.fortification.status !==
                              'not_applicable' &&
                            analysis.result.product_category !== 'DIETARY_SUPPLEMENT' && (
                              <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-slate-900">
                                    Fortification Policy
                                  </h4>
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${
                                      analysis.result.additional_requirements.fortification
                                        .status === 'compliant'
                                        ? 'bg-green-100 text-green-800'
                                        : analysis.result.additional_requirements.fortification
                                              .status === 'non_compliant'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {formatComplianceStatus(
                                      analysis.result.additional_requirements.fortification.status
                                    )}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700">
                                  {analysis.result.additional_requirements.fortification.details}
                                </p>
                                {analysis.result.additional_requirements.fortification
                                  .regulation_citation && (
                                  <p className="text-xs text-slate-500 mt-2">
                                    <span className="font-medium">Regulation:</span>{' '}
                                    {
                                      analysis.result.additional_requirements.fortification
                                        .regulation_citation
                                    }
                                  </p>
                                )}
                              </div>
                            )}
                          {analysis.result.additional_requirements?.other_requirements &&
                            analysis.result.additional_requirements.other_requirements.length > 0 &&
                            analysis.result.additional_requirements.other_requirements.map(
                              (req: OtherRequirement, idx: number) => (
                                <div key={idx} className="bg-slate-50 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-900">
                                      {req.requirement}
                                    </h4>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        req.status === 'compliant'
                                          ? 'bg-green-100 text-green-800'
                                          : req.status === 'non_compliant'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {formatComplianceStatus(req.status)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700">{req.details}</p>
                                </div>
                              )
                            )}
                        </div>
                      </div>
                    )}

                    {/* Compliance Summary Table */}
                    <ComplianceSummaryTable
                      complianceTable={analysis.result.compliance_table || []}
                    />

                    {/* Recommendations */}
                    <RecommendationsPanel recommendations={analysis.result.recommendations || []} />

                    {/* Duplicate Analysis Session Active Component at Bottom */}
                    {analysis.sessionId && (
                      <div className="mt-12 pt-8 border-t-2 border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                          Continue Improving This Analysis
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => session.openChat()}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
                          >
                            <div className="p-2 bg-blue-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-blue-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Ask AI Questions</div>
                              <div className="text-xs text-slate-600">Get expert help</div>
                            </div>
                          </button>

                          <button
                            onClick={() => session.openTextChecker()}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all"
                          >
                            <div className="p-2 bg-green-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">
                                Check Text Alternative
                              </div>
                              <div className="text-xs text-slate-600">Test revised content</div>
                            </div>
                          </button>

                          <button
                            onClick={handleUploadRevised}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                          >
                            <div className="p-2 bg-purple-100 rounded">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-purple-600"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">
                                Upload Revised Label
                              </div>
                              <div className="text-xs text-slate-600">Test your improvements</div>
                            </div>
                          </button>

                          {(analysis.result.category_ambiguity?.is_ambiguous ||
                            analysis.result.overall_assessment?.category_violation_present) && (
                            <button
                              onClick={() => session.openComparison()}
                              className="flex items-center gap-3 p-4 bg-white border-2 border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-all"
                            >
                              <div className="p-2 bg-amber-100 rounded">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5 text-amber-600"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  <path d="M12 3v18" strokeDasharray="2 2" />
                                </svg>
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-slate-900">
                                  Compare Categories
                                </div>
                                <div className="text-xs text-slate-600">
                                  View side-by-side options
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog
        open={session.shareDialogOpen}
        onOpenChange={(open) => !open && session.closeShareDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Analysis Report</DialogTitle>
            <DialogDescription>
              Anyone with this link will be able to view this analysis report.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input id="share-link" value={session.shareUrl} readOnly className="bg-slate-50" />
            </div>
            <Button type="button" size="sm" className="px-3" onClick={handleCopyLink}>
              {session.copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span className="ml-2">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="ml-2">Copy</span>
                </>
              )}
            </Button>
          </div>
          <div className="text-sm text-slate-600">
            <p className="font-semibold mb-1">Share this link to:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Show compliance results to clients or stakeholders</li>
              <li>Get feedback from regulatory consultants</li>
              <li>Keep a permanent record outside your account</li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Interface */}
      {analysis.sessionId && (
        <AnalysisChat
          sessionId={analysis.sessionId}
          isOpen={session.isChatOpen}
          onClose={() => session.closeChat()}
        />
      )}

      {/* Text Checker */}
      {analysis.sessionId && (
        <TextChecker
          sessionId={analysis.sessionId}
          isOpen={session.isTextCheckerOpen}
          onClose={() => session.closeTextChecker()}
          onAnalysisComplete={handleTextAnalysisComplete}
        />
      )}
    </div>
  );
}
