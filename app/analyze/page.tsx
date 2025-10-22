'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Loader2, AlertCircle, Download, Share2, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { exportSingleAnalysisAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

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

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
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
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
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

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !userId) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      setResult(data);
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

          {!result ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-900">Upload Image</CardTitle>
                <CardDescription>Take a clear photo of the nutrition facts label</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {!previewUrl ? (
                    <div
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer block">
                        <div className="flex flex-col items-center pointer-events-none">
                          <div className={`p-4 rounded-full mb-4 transition-colors ${
                            isDragging ? 'bg-blue-200' : 'bg-blue-100'
                          }`}>
                            <Upload className="h-8 w-8 text-blue-600" />
                          </div>
                          <p className="text-lg font-medium text-slate-900 mb-2">
                            {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-sm text-slate-500">PNG, JPG or JPEG up to 10MB</p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-lg overflow-hidden border border-slate-200">
                        <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-96 object-contain bg-slate-50" />
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
                    <div className="flex gap-2">
                      <Button onClick={handleShare} variant="outline" className="border-slate-300 hover:bg-slate-50 gap-2">
                        <Share2 className="h-4 w-4" />
                        Share
                      </Button>
                      <Button onClick={handleDownloadPDF} variant="outline" className="border-slate-300 hover:bg-slate-50 gap-2">
                        <Download className="h-4 w-4" />
                        Download PDF
                      </Button>
                      <Button onClick={handleReset} variant="outline" className="border-slate-300 hover:bg-slate-50">
                        New Analysis
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
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
                                {result.overall_assessment.primary_compliance_status?.replace('_', ' ').toUpperCase()}
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
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
                                  {result.general_labeling.statement_of_identity.status}
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
                                  {result.general_labeling.net_quantity.status}
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
                                  {result.general_labeling.manufacturer_address.status}
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
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
                              {result.ingredient_labeling.status}
                            </span>
                          </div>
                          {result.ingredient_labeling.ingredients_list && result.ingredient_labeling.ingredients_list.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-slate-600 mb-1">Ingredients:</p>
                              <p className="text-sm text-slate-700">{result.ingredient_labeling.ingredients_list.join(', ')}</p>
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                          3. Food Allergen Labeling (FALCPA/FASTER Act)
                        </h3>
                        <div className={`rounded-lg p-4 border-2 ${
                          result.allergen_labeling.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                          result.allergen_labeling.risk_level === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                          'bg-green-50 border-green-300'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Allergen Declaration Compliance</h4>
                            <div className="flex gap-2 items-center">
                              {result.allergen_labeling.risk_level && (
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
                                {result.allergen_labeling.status}
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                          4. Nutrition Labeling and Claims
                        </h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Nutrition Facts Panel</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              result.nutrition_labeling.status === 'compliant' ? 'bg-green-100 text-green-800' :
                              result.nutrition_labeling.status === 'non_compliant' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {result.nutrition_labeling.status}
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
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-xs font-semibold text-blue-900 mb-1">Exemption Reason:</p>
                              <p className="text-sm text-blue-800">{result.nutrition_labeling.exemption_reason}</p>
                            </div>
                          )}
                          <p className="text-sm text-slate-700 mb-2">{result.nutrition_labeling.details}</p>
                          <p className="text-xs text-slate-500">{result.nutrition_labeling.regulation_citation}</p>
                        </div>
                      </div>
                    )}

                    {/* Additional Requirements */}
                    {result.additional_requirements && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                          5. Additional Regulatory Requirements
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
                                  {result.additional_requirements.fortification.status}
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
                                    {req.status}
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
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                          Summary of Compliance Evaluation
                        </h3>
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
                              {result.compliance_table.map((row: any, idx: number) => (
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
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b-2 border-slate-200">
                          Recommendations
                        </h3>
                        <div className="space-y-3">
                          {result.recommendations.map((rec: any, index: number) => (
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
    </div>
  );
}
