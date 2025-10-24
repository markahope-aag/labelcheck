'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Loader2, AlertCircle, Download, Share2, Copy, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { exportSingleAnalysisAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';
import { AnalysisChat } from '@/components/AnalysisChat';
import { TextChecker } from '@/components/TextChecker';
import CategorySelector from '@/components/CategorySelector';
import CategoryComparison from '@/components/CategoryComparison';
import { ProductCategory } from '@/lib/supabase';

// Helper function to format compliance status for display
const formatComplianceStatus = (status: string): string => {
  if (!status) return '';

  // Handle specific cases
  const statusMap: Record<string, string> = {
    'compliant': 'Compliant',
    'likely_compliant': 'Likely Compliant',
    'non_compliant': 'Non-Compliant',
    'potentially_non_compliant': 'Potentially-Non-Compliant',
    'not_applicable': 'Not Applicable',
    'warning': 'Warning',
  };

  return statusMap[status] || status.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('-');
};

export default function AnalyzePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTextCheckerOpen, setIsTextCheckerOpen] = useState(false);
  const [isRevisedMode, setIsRevisedMode] = useState(false);
  const [previousResult, setPreviousResult] = useState<any>(null);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');

  const processFile = (file: File) => {
    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Accept both images and PDFs
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' ||
                  file.type === 'application/x-pdf' ||
                  file.name.toLowerCase().endsWith('.pdf');

    console.log('File validation - isImage:', isImage, 'isPdf:', isPdf);

    if (!isImage && !isPdf) {
      const errorMsg = `Please select a valid image or PDF file (received: ${file.type || 'unknown type'})`;
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    setSelectedFile(file);

    // Create preview - for PDFs, show a placeholder
    if (isPdf) {
      setPreviewUrl(''); // Will show PDF indicator instead
    } else {
      setPreviewUrl(URL.createObjectURL(file));
    }

    setError('');
    setResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the drop zone
    // Check if the related target is outside the current target
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log('Drop event triggered');
    const files = e.dataTransfer.files;
    console.log('Files dropped:', files.length);

    if (files && files.length > 0) {
      processFile(files[0]);
    } else {
      console.error('No files in drop event');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !userId) return;

    setIsAnalyzing(true);
    setError('');
    setAnalysisProgress(0);
    setAnalysisStep('Uploading file...');

    // Track start time for long-running analyses
    const startTime = Date.now();

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);

        // Continue progressing beyond 90%, but more slowly
        if (prev < 98) {
          // Faster progress up to 90%
          const increment = prev < 90
            ? Math.random() * 3 + 1  // 1-4% increment
            : Math.random() * 0.5 + 0.1; // 0.1-0.6% increment (much slower)

          const newProgress = Math.min(prev + increment, 98);

          // Update step message based on progress
          if (newProgress < 20) {
            setAnalysisStep('Uploading file...');
          } else if (newProgress < 40) {
            setAnalysisStep('Processing image...');
          } else if (newProgress < 70) {
            setAnalysisStep('Analyzing with AI (this may take 60-90 seconds)...');
          } else if (newProgress < 90) {
            setAnalysisStep('Performing comprehensive regulatory analysis...');
          } else {
            // Show different messages based on elapsed time
            if (elapsedSeconds > 60) {
              setAnalysisStep('Complex label detected - performing detailed analysis...');
            } else {
              setAnalysisStep('Finalizing results...');
            }
          }

          return newProgress;
        }
        return prev;
      });
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      // If in revised mode, pass the sessionId
      if (isRevisedMode && sessionId) {
        formData.append('sessionId', sessionId);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalysisStep('Complete!');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      // Store session ID if present
      if (data.session?.id) {
        setSessionId(data.session.id);
      }

      // Check if category selector should be shown
      if (data.show_category_selector) {
        // Store analysis data temporarily
        setAnalysisData(data);
        setShowCategorySelector(true);
        // Don't set result yet - wait for category selection
      } else {
        // No category selection needed, show results immediately
        setResult(data);
        setShowCategorySelector(false);
      }

      // If this was a revised upload, exit revised mode
      if (isRevisedMode) {
        setIsRevisedMode(false);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setResult(null);
    setError('');
    setSessionId(null);
    setShowCategorySelector(false);
    setShowComparison(false);
    setAnalysisData(null); // Clear when starting completely new analysis
  };

  const handleCategorySelect = async (category: ProductCategory, reason?: string) => {
    if (!analysisData) return;

    // Update the database with user's category selection
    if (analysisData.id && category !== analysisData.product_category) {
      try {
        await fetch('/api/analyze/select-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisId: analysisData.id,
            selectedCategory: category,
            selectionReason: reason || null,
          }),
        });
      } catch (error) {
        console.error('Error saving category selection:', error);
        // Continue anyway - don't block user from seeing results
      }
    }

    // Show the results with the selected category
    setResult(analysisData);
    setShowCategorySelector(false);
    setShowComparison(false);
    // DON'T clear analysisData - keep it so user can go back and try other categories
  };

  const handleChangeCategoryClick = () => {
    // Go back to category selector to try a different classification
    setShowCategorySelector(true);
    setShowComparison(false);
  };

  const handleCompare = () => {
    setShowComparison(true);
    setShowCategorySelector(false);
  };

  const handleBackToSelector = () => {
    setShowComparison(false);
    setShowCategorySelector(true);
  };

  const handleDownloadPDF = async () => {
    if (!result) return;

    try {
      await exportSingleAnalysisAsPDF(result);
      toast({
        title: 'Success',
        description: 'Compliance report downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to download PDF report',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (!result?.id) return;

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: result.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate share link');
      }

      setShareUrl(data.shareUrl);
      setShareDialogOpen(true);
      setCopied(false);
    } catch (error: any) {
      console.error('Error generating share link:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate share link',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link Copied!',
        description: 'The shareable link has been copied to your clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleTextAnalysisComplete = (analysisResult: any) => {
    // Update the result state with the text analysis
    setResult({
      ...analysisResult,
      analysisType: 'text_check',
      image_name: 'Text Content Analysis',
    });

    toast({
      title: 'Text Analysis Complete',
      description: 'Your prospective label content has been analyzed',
    });
  };

  const handleUploadRevised = () => {
    // Store the current result for comparison
    setPreviousResult(result);

    // Enter revised mode
    setIsRevisedMode(true);

    // Clear current file to show upload UI
    setSelectedFile(null);
    setPreviewUrl('');
    setResult(null);

    toast({
      title: 'Upload Revised Label',
      description: 'Upload your updated label to see the improvements',
    });
  };

  // Calculate comparison between previous and current results
  const calculateComparison = () => {
    if (!previousResult || !result) return null;

    const prevStatus = previousResult.overall_assessment?.primary_compliance_status || '';
    const currStatus = result.overall_assessment?.primary_compliance_status || '';

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
    const countIssuesInSection = (section: any, counters: any) => {
      if (!section) return;
      Object.values(section).forEach((item: any) => {
        if (item && item.status) {
          if (item.status === 'non_compliant') counters.critical++;
          else if (item.status === 'warning' || item.status === 'potentially_non_compliant') counters.warning++;
          else if (item.status === 'compliant') counters.compliant++;
        }
      });
    };

    // Count issues in both results
    [previousResult, result].forEach((res, idx) => {
      const counters = idx === 0 ? prevIssues : currIssues;
      countIssuesInSection(res.general_labeling, counters);
      countIssuesInSection(res.nutrition_labeling, counters);
      countIssuesInSection(res.allergen_labeling, counters);
      countIssuesInSection(res.claims_and_statements, counters);
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
      statusImproved: prevStatus !== currStatus &&
        (currStatus === 'compliant' || currStatus === 'likely_compliant'),
    };
  };

  const comparison = previousResult && result ? calculateComparison() : null;

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

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showComparison && analysisData ? (
            // Show Category Comparison when user clicks "Compare All Options Side-by-Side"
            <CategoryComparison
              aiCategory={analysisData.product_category}
              confidence={analysisData.category_confidence || 'medium'}
              categoryRationale={analysisData.category_rationale || ''}
              alternatives={analysisData.category_ambiguity?.alternative_categories || []}
              categoryOptions={analysisData.category_options || {}}
              labelConflicts={analysisData.category_ambiguity?.label_conflicts || []}
              recommendation={analysisData.recommendation}
              onSelect={handleCategorySelect}
              onBack={handleBackToSelector}
            />
          ) : showCategorySelector && analysisData ? (
            // Show Category Selector when ambiguity is detected
            <CategorySelector
              aiCategory={analysisData.product_category}
              confidence={analysisData.category_confidence || 'medium'}
              categoryRationale={analysisData.category_rationale || ''}
              alternatives={analysisData.category_ambiguity?.alternative_categories || []}
              categoryOptions={analysisData.category_options || {}}
              labelConflicts={analysisData.category_ambiguity?.label_conflicts || []}
              recommendation={analysisData.recommendation}
              onSelect={handleCategorySelect}
              onCompare={handleCompare}
            />
          ) : !result || isRevisedMode ? (
            <>
              {isRevisedMode && previousResult && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900">Revision Mode Active</h3>
                      <p className="text-sm text-purple-700">
                        Upload your revised label to see how your changes compare to the previous analysis
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    {isRevisedMode ? 'Upload Revised Label' : 'Upload Image'}
                  </CardTitle>
                  <CardDescription>
                    {isRevisedMode
                      ? 'Upload your updated label to see the improvements'
                      : 'Take a clear photo of the nutrition facts label'}
                  </CardDescription>
                </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {!selectedFile ? (
                    <div
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                      />
                      <div className="flex flex-col items-center pointer-events-none">
                        <div className={`p-4 rounded-full mb-4 transition-colors ${
                          isDragging ? 'bg-blue-200' : 'bg-blue-100'
                        }`}>
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 mb-2">
                          {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-sm text-slate-500">PNG, JPG, JPEG or PDF up to 10MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-lg overflow-hidden border border-slate-200">
                        {selectedFile?.type === 'application/pdf' ? (
                          <div className="flex flex-col items-center justify-center p-12 bg-slate-50">
                            <div className="p-4 bg-red-100 rounded-full mb-4">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <p className="font-semibold text-slate-900 mb-1">{selectedFile.name}</p>
                            <p className="text-sm text-slate-600">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p className="text-xs text-slate-500 mt-2">PDF ready for analysis</p>
                          </div>
                        ) : (
                          <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-96 object-contain bg-slate-50" />
                        )}
                      </div>
                      <div className="flex gap-4">
                        <Button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Camera className="h-4 w-4 mr-2" />
                              Analyze Label
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleReset}
                          variant="outline"
                          disabled={isAnalyzing}
                          className="border-slate-300 hover:bg-slate-50"
                        >
                          Cancel
                        </Button>
                      </div>

                      {/* Progress Bar */}
                      {isAnalyzing && (
                        <div className="space-y-3 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">
                              {analysisStep}
                            </span>
                            <span className="text-sm font-semibold text-blue-700">
                              {Math.round(analysisProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${analysisProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-blue-700">
                            This typically takes 60-90 seconds. Please wait...
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Tips for best results:</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Ensure good lighting and the label is clearly visible</li>
                      <li>• Capture the entire nutrition facts panel</li>
                      <li>• Avoid glare and shadows on the label</li>
                      <li>• Hold your camera steady for a sharp image</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
          ) : (
            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-semibold text-slate-900">
                        {result.product_name || 'Analysis Results'}
                      </CardTitle>
                      <CardDescription>{result.product_type || 'Regulatory Compliance Analysis'}</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* Show "Change Category" button if this result came from category selection */}
                      {analysisData && analysisData.category_ambiguity?.alternative_categories?.length > 0 && (
                        <Button
                          onClick={handleChangeCategoryClick}
                          variant="outline"
                          className="border-orange-400 text-orange-700 hover:bg-orange-50 gap-2"
                        >
                          <AlertCircle className="h-4 w-4" />
                          Change Category
                        </Button>
                      )}
                      <Button onClick={handleShare} variant="outline" className="border-slate-300 hover:bg-slate-50 gap-2">
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                      <Button onClick={handleDownloadPDF} variant="outline" className="border-slate-300 hover:bg-slate-50 gap-2">
                        <Download className="h-4 w-4" />
                        Download PDF
                      </Button>
                      <Button onClick={handleReset} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <RotateCcw className="h-4 w-4" />
                        New Analysis
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Session Context */}
                    {sessionId && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-blue-900">Analysis Session Active</h3>
                            <p className="text-sm text-blue-700">You can now iterate on this analysis to improve compliance</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <button
                            onClick={() => setIsChatOpen(true)}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
                          >
                            <div className="p-2 bg-blue-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Ask AI Questions</div>
                              <div className="text-xs text-slate-600">Get expert help</div>
                            </div>
                          </button>

                          <button
                            onClick={() => setIsTextCheckerOpen(true)}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all"
                          >
                            <div className="p-2 bg-green-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Check Text Alternative</div>
                              <div className="text-xs text-slate-600">Test revised content</div>
                            </div>
                          </button>

                          <button
                            onClick={handleUploadRevised}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                          >
                            <div className="p-2 bg-purple-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Upload Revised Label</div>
                              <div className="text-xs text-slate-600">Test your improvements</div>
                            </div>
                          </button>
                        </div>

                        <div className="mt-4 p-3 bg-blue-100 bg-opacity-50 rounded-lg">
                          <p className="text-xs text-blue-800">
                            <strong>Session ID:</strong> <code className="font-mono text-xs">{sessionId.substring(0, 8)}...</code> •
                            This session maintains context across multiple iterations
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Comparison Results */}
                    {comparison && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-purple-900">Revision Comparison</h3>
                            <p className="text-sm text-purple-700">See how your changes improved compliance</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Previous Issues */}
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <div className="text-sm font-semibold text-slate-600 mb-1">Previous Analysis</div>
                            <div className="text-3xl font-bold text-slate-900">{comparison.prevIssues}</div>
                            <div className="text-sm text-slate-600">issues found</div>
                          </div>

                          {/* Improvement */}
                          <div className="bg-white rounded-lg p-4 border-2 border-purple-300 flex items-center justify-center">
                            <div className="text-center">
                              {comparison.improvement > 0 ? (
                                <>
                                  <div className="text-4xl font-bold text-green-600">↓ {comparison.improvement}</div>
                                  <div className="text-sm font-semibold text-green-700 mt-1">Issues Resolved</div>
                                </>
                              ) : comparison.improvement < 0 ? (
                                <>
                                  <div className="text-4xl font-bold text-red-600">↑ {Math.abs(comparison.improvement)}</div>
                                  <div className="text-sm font-semibold text-red-700 mt-1">New Issues</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-4xl font-bold text-yellow-600">=</div>
                                  <div className="text-sm font-semibold text-yellow-700 mt-1">No Change</div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Current Issues */}
                          <div className={`rounded-lg p-4 border-2 ${
                            comparison.currIssues === 0
                              ? 'bg-green-50 border-green-300'
                              : 'bg-white border-purple-200'
                          }`}>
                            <div className="text-sm font-semibold text-slate-600 mb-1">Current Analysis</div>
                            <div className={`text-3xl font-bold ${
                              comparison.currIssues === 0 ? 'text-green-600' : 'text-slate-900'
                            }`}>
                              {comparison.currIssues}
                            </div>
                            <div className={`text-sm ${
                              comparison.currIssues === 0 ? 'text-green-700 font-semibold' : 'text-slate-600'
                            }`}>
                              {comparison.currIssues === 0 ? '✓ Fully Compliant!' : 'issues remaining'}
                            </div>
                          </div>
                        </div>

                        {comparison.statusImproved && (
                          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                            <div className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

                    {/* Overall Assessment */}
                    {result.overall_assessment && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-blue-900 mb-2">Overall Compliance Status</h3>
                            <div className="mb-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                result.overall_assessment.primary_compliance_status === 'compliant' ? 'bg-green-100 text-green-800' :
                                result.overall_assessment.primary_compliance_status === 'likely_compliant' ? 'bg-green-50 text-green-700' :
                                result.overall_assessment.primary_compliance_status === 'potentially_non_compliant' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {formatComplianceStatus(result.overall_assessment.primary_compliance_status)}
                              </span>
                              <span className="ml-3 text-sm text-blue-700">
                                Confidence: {result.overall_assessment.confidence_level}
                              </span>
                            </div>
                            <p className="text-blue-800 leading-relaxed mb-3">{result.overall_assessment.summary}</p>
                            {result.overall_assessment.key_findings && result.overall_assessment.key_findings.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-blue-900 mb-2">Key Findings:</h4>
                                <ul className="space-y-1">
                                  {result.overall_assessment.key_findings.map((finding: string, idx: number) => (
                                    <li key={idx} className="text-sm text-blue-800">• {finding}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* General Labeling Requirements */}
                    {result.general_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          1. General Labeling Requirements
                        </h3>
                        <div className="space-y-4">
                          {result.general_labeling.statement_of_identity && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">Statement of Identity</h4>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result.general_labeling.statement_of_identity.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  result.general_labeling.statement_of_identity.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {formatComplianceStatus(result.general_labeling.statement_of_identity.status)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">{result.general_labeling.statement_of_identity.details}</p>
                              <p className="text-xs text-slate-500">{result.general_labeling.statement_of_identity.regulation_citation}</p>
                            </div>
                          )}
                          {result.general_labeling.net_quantity && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">Net Quantity of Contents</h4>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result.general_labeling.net_quantity.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  result.general_labeling.net_quantity.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {formatComplianceStatus(result.general_labeling.net_quantity.status)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">{result.general_labeling.net_quantity.details}</p>
                              <p className="text-xs text-slate-500">{result.general_labeling.net_quantity.regulation_citation}</p>
                            </div>
                          )}
                          {result.general_labeling.manufacturer_address && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">Manufacturer/Distributor Address</h4>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result.general_labeling.manufacturer_address.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  result.general_labeling.manufacturer_address.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {formatComplianceStatus(result.general_labeling.manufacturer_address.status)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mb-2">{result.general_labeling.manufacturer_address.details}</p>
                              <p className="text-xs text-slate-500">{result.general_labeling.manufacturer_address.regulation_citation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ingredient Labeling */}
                    {result.ingredient_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          2. Ingredient Labeling
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Ingredient Declaration</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.ingredient_labeling.status === 'compliant' ? 'bg-green-100 text-green-800' :
                              result.ingredient_labeling.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {formatComplianceStatus(result.ingredient_labeling.status)}
                            </span>
                          </div>
                          {result.ingredient_labeling.ingredients_list && result.ingredient_labeling.ingredients_list.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-slate-600 mb-2">Ingredients:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {result.ingredient_labeling.ingredients_list.map((ingredient: string, idx: number) => {
                                  // Find GRAS status for this ingredient
                                  const grasStatus = result.gras_compliance?.detailed_results?.find(
                                    (r: any) => r.ingredient === ingredient
                                  );
                                  const isGRAS = grasStatus?.isGRAS;

                                  return (
                                    <span
                                      key={idx}
                                      className={`px-2 py-1 rounded text-sm ${
                                        isGRAS === true
                                          ? 'bg-green-100 text-green-800'
                                          : isGRAS === false
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                      title={
                                        isGRAS === true
                                          ? `✓ GRAS Compliant${grasStatus.matchType ? ` (${grasStatus.matchType} match)` : ''}`
                                          : isGRAS === false
                                          ? '✗ Not in GRAS database'
                                          : 'GRAS status unknown'
                                      }
                                    >
                                      {ingredient}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 mb-2">{result.ingredient_labeling.details}</p>
                          <p className="text-xs text-slate-500">{result.ingredient_labeling.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Allergen Labeling */}
                    {result.allergen_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          3. Food Allergen Labeling (FALCPA/FASTER Act)
                        </h3>
                        <div className={`rounded-lg p-4 border-2 ${
                          result.allergen_labeling.status === 'not_applicable' || result.allergen_labeling.status === 'compliant'
                            ? 'bg-slate-50 border-slate-300' :
                          result.allergen_labeling.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                          result.allergen_labeling.risk_level === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                          'bg-green-50 border-green-300'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Allergen Declaration Compliance</h4>
                            <div className="flex gap-2 items-center">
                              {result.allergen_labeling.risk_level && result.allergen_labeling.status !== 'not_applicable' && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result.allergen_labeling.risk_level === 'high' ? 'bg-red-200 text-red-900' :
                                  result.allergen_labeling.risk_level === 'medium' ? 'bg-yellow-200 text-yellow-900' :
                                  'bg-green-200 text-green-900'
                                }`}>
                                  Risk: {result.allergen_labeling.risk_level}
                                </span>
                              )}
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                result.allergen_labeling.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                result.allergen_labeling.status === 'potentially_non_compliant' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {formatComplianceStatus(result.allergen_labeling.status)}
                              </span>
                            </div>
                          </div>
                          {result.allergen_labeling.potential_allergens && result.allergen_labeling.potential_allergens.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Potential Allergen-Containing Ingredients:</p>
                              <ul className="text-sm text-slate-800 space-y-1">
                                {result.allergen_labeling.potential_allergens.map((allergen: string, idx: number) => (
                                  <li key={idx}>• {allergen}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-sm text-slate-800 mb-2">{result.allergen_labeling.details}</p>
                          <p className="text-xs text-slate-600">{result.allergen_labeling.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Nutrition Labeling */}
                    {result.nutrition_labeling && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          4. Nutrition Labeling
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Nutrition Facts Panel</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.nutrition_labeling.status === 'compliant' ? 'bg-green-100 text-green-800' :
                              result.nutrition_labeling.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {formatComplianceStatus(result.nutrition_labeling.status)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Panel Present:</span>
                              <span className="ml-2 text-slate-600">{result.nutrition_labeling.panel_present ? 'Yes' : 'No'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">Exemption Applicable:</span>
                              <span className="ml-2 text-slate-600">{result.nutrition_labeling.exemption_applicable ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                          {result.nutrition_labeling.exemption_reason && (
                            <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Exemption Reason:</p>
                              <p className="text-sm text-slate-800">{result.nutrition_labeling.exemption_reason}</p>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 mb-2">{result.nutrition_labeling.details}</p>
                          <p className="text-xs text-slate-500">{result.nutrition_labeling.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Supplement Facts Panel (for supplements) */}
                    {result.supplement_facts_panel && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          4. Supplement Facts Panel
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Supplement Facts Panel Compliance</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.supplement_facts_panel.status === 'compliant' ? 'bg-green-100 text-green-800' :
                              result.supplement_facts_panel.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {formatComplianceStatus(result.supplement_facts_panel.status)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                            <div>
                              <span className="font-semibold text-slate-700">Panel Present:</span>
                              <span className="ml-2 text-slate-600">{result.supplement_facts_panel.panel_present ? 'Yes' : 'No'}</span>
                            </div>
                            {result.supplement_facts_panel.wrong_panel_type !== undefined && (
                              <div>
                                <span className="font-semibold text-slate-700">Wrong Panel Type:</span>
                                <span className="ml-2 text-slate-600">{result.supplement_facts_panel.wrong_panel_type ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-2">{result.supplement_facts_panel.details}</p>
                          <p className="text-xs text-slate-500">{result.supplement_facts_panel.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Claims */}
                    {result.claims && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          5. Claims
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Claims Compliance</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.claims.status === 'compliant' ? 'bg-green-100 text-green-800' :
                              result.claims.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {formatComplianceStatus(result.claims.status)}
                            </span>
                          </div>
                          {result.claims.structure_function_claims && result.claims.structure_function_claims.length > 0 && (
                            <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Structure/Function Claims:</p>
                              <ul className="text-sm text-slate-800 space-y-1">
                                {result.claims.structure_function_claims.map((claim: string, idx: number) => (
                                  <li key={idx}>• {claim}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.claims.nutrient_content_claims && result.claims.nutrient_content_claims.length > 0 && (
                            <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Nutrient Content Claims:</p>
                              <ul className="text-sm text-slate-800 space-y-1">
                                {result.claims.nutrient_content_claims.map((claim: string, idx: number) => (
                                  <li key={idx}>• {claim}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.claims.health_claims && result.claims.health_claims.length > 0 && (
                            <div className="mb-3 p-3 bg-slate-100 border border-slate-300 rounded">
                              <p className="text-xs font-semibold text-slate-700 mb-1">Health Claims:</p>
                              <ul className="text-sm text-slate-800 space-y-1">
                                {result.claims.health_claims.map((claim: string, idx: number) => (
                                  <li key={idx}>• {claim}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {result.claims.prohibited_claims && result.claims.prohibited_claims.length > 0 && (
                            <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded">
                              <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Prohibited Claims Detected:</p>
                              <ul className="text-sm text-red-800 space-y-1">
                                {result.claims.prohibited_claims.map((claim: string, idx: number) => (
                                  <li key={idx}>• {claim}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 mb-2">{result.claims.details}</p>
                          <p className="text-xs text-slate-500">{result.claims.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Additional Requirements */}
                    {result.additional_requirements && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          6. Additional Regulatory Requirements
                        </h3>
                        <div className="space-y-3">
                          {result.additional_requirements.fortification && (
                            <div className="bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-900">Fortification Policy</h4>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result.additional_requirements.fortification.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                  result.additional_requirements.fortification.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {formatComplianceStatus(result.additional_requirements.fortification.status)}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700">{result.additional_requirements.fortification.details}</p>
                            </div>
                          )}
                          {result.additional_requirements.other_requirements && result.additional_requirements.other_requirements.length > 0 && (
                            result.additional_requirements.other_requirements.map((req: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-slate-900">{req.requirement}</h4>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    req.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                    req.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {formatComplianceStatus(req.status)}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700">{req.details}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Compliance Summary Table */}
                    {result.compliance_table && result.compliance_table.length > 0 && (
                      <div className="mt-12 pt-8 border-t-4 border-slate-300">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-slate-900 mb-2">
                            Summary of Compliance Evaluation
                          </h3>
                          <p className="text-sm text-slate-600">
                            This table summarizes the compliance status for all sections analyzed above
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">Labeling Element</th>
                                <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">Compliance Status</th>
                                <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">Rationale/Condition for Compliance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...result.compliance_table]
                                .sort((a, b) => {
                                  // Define section order to match analysis structure
                                  const sectionOrder: Record<string, number> = {
                                    // Section 1: General Labeling
                                    'Statement of Identity': 100,
                                    'Product Name': 101,
                                    'Net Quantity': 110,
                                    'Manufacturer': 120,
                                    'Manufacturer Address': 121,
                                    'Distributor': 122,

                                    // Section 2: Ingredient Labeling
                                    'Ingredient': 200,
                                    'Ingredients': 200,
                                    'Ingredient List': 201,
                                    'Ingredient Declaration': 202,
                                    'Ingredient Labeling': 203,

                                    // Section 3: Allergen Labeling
                                    'Allergen': 300,
                                    'Major Food Allergen': 301,
                                    'Allergen Labeling': 302,
                                    'Allergen Declaration': 303,
                                    'FALCPA': 304,

                                    // Section 4: Nutrition/Supplement Facts
                                    'Nutrition': 400,
                                    'Nutrition Facts': 401,
                                    'Nutrition Labeling': 402,
                                    'Supplement Facts': 410,
                                    'Supplement Facts Panel': 411,

                                    // Section 5: Claims
                                    'Claims': 500,
                                    'Structure': 501,
                                    'Nutrient Content': 502,
                                    'Health Claims': 503,

                                    // Section 6: Additional Requirements
                                    'Fortification': 600,
                                    'GRAS': 610,
                                    'GRAS Ingredient': 611,
                                    'NDI': 620,
                                    'New Dietary Ingredient': 621,
                                    'cGMP': 630,
                                  };

                                  // Find the lowest matching order value for each element
                                  const getOrder = (element: string) => {
                                    const lowerElement = element.toLowerCase();
                                    for (const [key, value] of Object.entries(sectionOrder)) {
                                      if (lowerElement.includes(key.toLowerCase())) {
                                        return value;
                                      }
                                    }
                                    return 999; // Unknown items go to the end
                                  };

                                  return getOrder(a.element) - getOrder(b.element);
                                })
                                .map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="border border-slate-300 px-4 py-2 text-sm text-slate-900">{row.element}</td>
                                  <td className="border border-slate-300 px-4 py-2 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      row.status === 'Compliant' || row.status === 'Likely Compliant' ? 'bg-green-100 text-green-800' :
                                      row.status === 'Potentially Non-compliant' ? 'bg-yellow-100 text-yellow-800' :
                                      row.status === 'Non-compliant' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {row.status}
                                    </span>
                                  </td>
                                  <td className="border border-slate-300 px-4 py-2 text-sm text-slate-700">{row.rationale}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {result.recommendations && result.recommendations.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
                          Recommendations
                        </h3>
                        <div className="space-y-3">
                          {[...result.recommendations]
                            .sort((a, b) => {
                              // Sort by priority: critical > high > medium > low
                              const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                              return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
                            })
                            .map((rec: any, index: number) => (
                            <div key={index} className={`rounded-lg p-4 border-l-4 ${
                              rec.priority === 'critical' ? 'bg-red-50 border-red-500' :
                              rec.priority === 'high' ? 'bg-orange-50 border-orange-500' :
                              rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                              'bg-blue-50 border-blue-500'
                            }`}>
                              <div className="flex items-start gap-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                  rec.priority === 'critical' ? 'bg-red-200 text-red-900' :
                                  rec.priority === 'high' ? 'bg-orange-200 text-orange-900' :
                                  rec.priority === 'medium' ? 'bg-yellow-200 text-yellow-900' :
                                  'bg-blue-200 text-blue-900'
                                }`}>
                                  {rec.priority}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm text-slate-900 mb-1">{rec.recommendation}</p>
                                  <p className="text-xs text-slate-600">{rec.regulation}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Analysis Session Active Component at Bottom */}
                    {sessionId && (
                      <div className="mt-12 pt-8 border-t-2 border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                          Continue Improving This Analysis
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <button
                            onClick={() => setIsChatOpen(true)}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
                          >
                            <div className="p-2 bg-blue-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Ask AI Questions</div>
                              <div className="text-xs text-slate-600">Get expert help</div>
                            </div>
                          </button>

                          <button
                            onClick={() => setIsTextCheckerOpen(true)}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all"
                          >
                            <div className="p-2 bg-green-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Check Text Alternative</div>
                              <div className="text-xs text-slate-600">Test revised content</div>
                            </div>
                          </button>

                          <button
                            onClick={handleUploadRevised}
                            className="flex items-center gap-3 p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                          >
                            <div className="p-2 bg-purple-100 rounded">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="font-semibold text-slate-900">Upload Revised Label</div>
                              <div className="text-xs text-slate-600">Test your improvements</div>
                            </div>
                          </button>
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
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Analysis Report</DialogTitle>
            <DialogDescription>
              Anyone with this link will be able to view this analysis report.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="share-link"
                value={shareUrl}
                readOnly
                className="bg-slate-50"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={handleCopyLink}
            >
              {copied ? (
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
      {sessionId && (
        <AnalysisChat
          sessionId={sessionId}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* Text Checker */}
      {sessionId && (
        <TextChecker
          sessionId={sessionId}
          isOpen={isTextCheckerOpen}
          onClose={() => setIsTextCheckerOpen(false)}
          onAnalysisComplete={handleTextAnalysisComplete}
        />
      )}
    </div>
  );
}
