'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportSingleAnalysisAsPDF } from '@/lib/export-helpers';
import { useToast } from '@/hooks/use-toast';

export default function SharePage() {
  const params = useParams();
  const { toast } = useToast();
  const token = params.token as string;
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalysis();
  }, [token]);

  async function loadAnalysis() {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('analyses')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Analysis not found or link has expired');
        setLoading(false);
        return;
      }

      setAnalysis(data);
    } catch (err: any) {
      console.error('Error loading shared analysis:', err);
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
          <div className="mb-6 text-center">
            <p className="text-sm text-slate-600">Shared Analysis • View Only</p>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    {result.product_name || 'Analysis Results'}
                  </CardTitle>
                  <CardDescription>{result.product_type || 'Regulatory Compliance Analysis'}</CardDescription>
                </div>
                <Button onClick={handleDownloadPDF} variant="outline" className="border-slate-300 hover:bg-slate-50 gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
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
                            <th className="border border-slate-300 px-4 py-2 text-left text-sm font-semibold text-slate-900">Rationale</th>
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

                <div className="pt-6 border-t border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-2">Want to analyze your own labels?</p>
                  <a href="/" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                    Try LabelCheck Free →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
