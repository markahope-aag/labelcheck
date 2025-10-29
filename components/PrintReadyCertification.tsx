'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PrintReadyCertificationProps {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  analysisDate: string;
  criticalIssues?: Array<{
    priority: string;
    recommendation: string;
    regulation?: string;
  }>;
  highIssues?: Array<{
    priority: string;
    recommendation: string;
    regulation?: string;
  }>;
}

export function PrintReadyCertification({
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
  analysisDate,
  criticalIssues = [],
  highIssues = []
}: PrintReadyCertificationProps) {
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false);
  const [showOptionalImprovements, setShowOptionalImprovements] = useState(false);

  const isPrintReady = criticalCount === 0 && highCount === 0;
  const blockingCount = criticalCount + highCount;
  const optionalCount = mediumCount + lowCount;

  if (isPrintReady) {
    return (
      <div className="space-y-4">
        {/* Print-Ready Banner */}
        <Card className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-green-900 mb-2">
                  Label is Print-Ready
                </CardTitle>
                <p className="text-green-800 text-lg">
                  No blocking compliance issues detected. All CRITICAL and HIGH priority items have been resolved.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="bg-amber-50 border-amber-300">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>IMPORTANT DISCLAIMER:</strong> This analysis is based on visible label elements only as of {new Date(analysisDate).toLocaleDateString()}.
                {' '}
                <button
                  onClick={() => setShowFullDisclaimer(!showFullDisclaimer)}
                  className="underline hover:text-amber-700"
                >
                  {showFullDisclaimer ? 'Hide details' : 'Read full disclaimer'}
                </button>
              </AlertDescription>
            </Alert>

            {showFullDisclaimer && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 space-y-2">
                <p className="font-semibold">This compliance analysis tool:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Does NOT verify nutritional accuracy or product formulation</li>
                  <li>Does NOT constitute legal or regulatory advice</li>
                  <li>Does NOT guarantee FDA approval or compliance</li>
                  <li>Does NOT replace consultation with qualified regulatory experts</li>
                </ul>

                <p className="font-semibold mt-3">The manufacturer/brand owner remains solely responsible for:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Accuracy of all claims and declarations</li>
                  <li>Product formula compliance with applicable regulations</li>
                  <li>GRAS determinations and ingredient approvals</li>
                  <li>Substantiation of health, nutrient, and structure/function claims</li>
                  <li>Compliance with state and local regulations</li>
                  <li>Updates to regulations after analysis date</li>
                </ul>

                <p className="mt-3 font-semibold">
                  Use of this service does not create an attorney-client or consultant-client relationship.
                  For final approval, consult a qualified food regulatory expert or attorney.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optional Improvements Section */}
        {optionalCount > 0 && (
          <Card className="border-slate-200">
            <CardHeader>
              <button
                onClick={() => setShowOptionalImprovements(!showOptionalImprovements)}
                className="w-full flex items-center justify-between text-left hover:bg-slate-50 -m-6 p-6 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Optional Improvements ({optionalCount} items)
                  </CardTitle>
                </div>
                {showOptionalImprovements ? (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                )}
              </button>
            </CardHeader>
            {showOptionalImprovements && (
              <CardContent className="pt-0">
                <p className="text-slate-600 mb-4">
                  These items are for your review and may require professional judgment or verification.
                  They do not block print-ready status.
                </p>
                <div className="space-y-2">
                  {mediumCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded font-medium">
                        MEDIUM
                      </span>
                      <span className="text-slate-700">
                        {mediumCount} {mediumCount === 1 ? 'item' : 'items'} requiring judgment or verification
                      </span>
                    </div>
                  )}
                  {lowCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                        LOW
                      </span>
                      <span className="text-slate-700">
                        {lowCount} best practice {lowCount === 1 ? 'suggestion' : 'suggestions'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    );
  }

  // Blocking Issues Present
  return (
    <Card className="border-orange-300 bg-gradient-to-r from-orange-50 to-red-50">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-12 w-12 text-orange-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-2xl font-bold text-orange-900 mb-2">
              {blockingCount} Blocking {blockingCount === 1 ? 'Issue' : 'Issues'} {blockingCount === 1 ? 'Remains' : 'Remain'}
            </CardTitle>
            <p className="text-orange-800 text-lg">
              Your label has compliance issues that must be fixed before printing to avoid FDA/TTB enforcement risk.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Critical Issues */}
        {criticalCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-sm">
                CRITICAL ({criticalCount})
              </span>
              <span className="text-sm text-red-900 font-medium">
                High risk of FDA enforcement action
              </span>
            </div>
            <div className="space-y-3">
              {criticalIssues.slice(0, 3).map((issue, index) => (
                <div key={index} className="bg-white border-l-4 border-red-600 rounded-r-lg p-4 shadow-sm">
                  <p className="text-slate-900 font-medium mb-1">
                    {issue.recommendation}
                  </p>
                  {issue.regulation && (
                    <p className="text-sm text-slate-600">
                      Regulation: {issue.regulation}
                    </p>
                  )}
                </div>
              ))}
              {criticalCount > 3 && (
                <p className="text-sm text-slate-600 italic">
                  + {criticalCount - 3} more critical {criticalCount - 3 === 1 ? 'issue' : 'issues'} (see full recommendations below)
                </p>
              )}
            </div>
          </div>
        )}

        {/* High Issues */}
        {highCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-orange-600 text-white rounded-lg font-bold text-sm">
                HIGH ({highCount})
              </span>
              <span className="text-sm text-orange-900 font-medium">
                Regulatory requirements
              </span>
            </div>
            <div className="space-y-3">
              {highIssues.slice(0, 2).map((issue, index) => (
                <div key={index} className="bg-white border-l-4 border-orange-600 rounded-r-lg p-4 shadow-sm">
                  <p className="text-slate-900 font-medium mb-1">
                    {issue.recommendation}
                  </p>
                  {issue.regulation && (
                    <p className="text-sm text-slate-600">
                      Regulation: {issue.regulation}
                    </p>
                  )}
                </div>
              ))}
              {highCount > 2 && (
                <p className="text-sm text-slate-600 italic">
                  + {highCount - 2} more high priority {highCount - 2 === 1 ? 'issue' : 'issues'} (see full recommendations below)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-orange-200">
          <p className="text-sm text-slate-700 mb-3">
            Scroll down to see full recommendations and details for each issue.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
