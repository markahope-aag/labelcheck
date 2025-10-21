'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, ArrowLeft, AlertCircle, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { exportSingleAnalysisAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useAuth();
  const { toast } = useToast();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userId) {
      loadAnalysis();
    }
  }, [userId, analysisId]);

  async function loadAnalysis() {
    if (!userId || !analysisId) {
      setError('Invalid analysis ID');
      setLoading(false);
      return;
    }

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_user_id', userId)
        .maybeSingle();

      if (!user) {
        setError('User not found');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', analysisId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Analysis not found');
        setLoading(false);
        return;
      }

      setAnalysis(data);
    } catch (err: any) {
      console.error('Error loading analysis:', err);
      setError('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }

  const handleDownloadPDF = async () => {
    if (!analysis) return;

    try {
      await exportSingleAnalysisAsPDF(analysis);
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
    if (!analysis?.id) return;

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: analysis.id }),
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

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 text-red-900">
                  <AlertCircle className="h-8 w-8" />
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Unable to Load Analysis</h3>
                    <p className="text-sm text-red-700">{error || 'This analysis could not be found.'}</p>
                  </div>
                </div>
                <Button onClick={() => router.push('/history')} variant="outline" className="mt-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const result = analysis.analysis_result;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button onClick={() => router.push('/history')} variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to History
            </Button>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    {result.product_name || 'Analysis Results'}
                  </CardTitle>
                  <CardDescription>
                    {result.product_type || 'Regulatory Compliance Analysis'} • {new Date(analysis.created_at).toLocaleDateString()}
                  </CardDescription>
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
