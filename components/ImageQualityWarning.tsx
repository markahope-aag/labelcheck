'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { ImageQualityMetrics, ImageQualityIssue } from '@/lib/image-quality';

interface ImageQualityWarningProps {
  metrics: ImageQualityMetrics;
  onProceed: () => void;
  onReupload: () => void;
}

export function ImageQualityWarning({ metrics, onProceed, onReupload }: ImageQualityWarningProps) {
  const { recommendation, qualityScore, issues, width, height, megapixels, blurScore, brightness, contrast } = metrics;

  // Color scheme based on recommendation
  const colors = {
    excellent: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-900', icon: CheckCircle },
    good: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-900', icon: CheckCircle },
    acceptable: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900', icon: AlertTriangle },
    poor: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-900', icon: XCircle },
    unusable: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-900', icon: XCircle },
  };

  const theme = colors[recommendation];
  const Icon = theme.icon;

  const getMessage = () => {
    switch (recommendation) {
      case 'excellent':
        return 'This image is high quality and should produce accurate analysis results.';
      case 'good':
        return 'This image quality is good. Analysis should work well.';
      case 'acceptable':
        return `This image quality is acceptable, but ${issues.length} issue(s) may reduce analysis accuracy.`;
      case 'poor':
        return 'This image quality is poor. We recommend re-uploading a better image for accurate analysis.';
      case 'unusable':
        return 'This image quality is too poor for reliable analysis. Please upload a clearer image.';
    }
  };

  return (
    <Card className={`${theme.border} ${theme.bg} border-2`}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Icon className={`h-8 w-8 ${theme.text} flex-shrink-0 mt-1`} />
          <div className="flex-1">
            <CardTitle className={`text-xl ${theme.text}`}>
              Image Quality: {recommendation.charAt(0).toUpperCase() + recommendation.slice(1)}
            </CardTitle>
            <CardDescription className={theme.text}>
              Quality Score: {qualityScore}/100
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main message */}
        <p className={theme.text}>{getMessage()}</p>

        {/* Technical details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/50 p-2 rounded">
            <div className="font-medium">Resolution</div>
            <div className={theme.text}>
              {width} × {height} ({megapixels.toFixed(2)} MP)
            </div>
          </div>
          <div className="bg-white/50 p-2 rounded">
            <div className="font-medium">Sharpness</div>
            <div className={theme.text}>{blurScore.toFixed(0)}/100 {blurScore < 30 && '⚠️ Blurry'}</div>
          </div>
          <div className="bg-white/50 p-2 rounded">
            <div className="font-medium">Brightness</div>
            <div className={theme.text}>{brightness.toFixed(0)}/255</div>
          </div>
          <div className="bg-white/50 p-2 rounded">
            <div className="font-medium">Contrast</div>
            <div className={theme.text}>{contrast.toFixed(0)}/100</div>
          </div>
        </div>

        {/* Issues list */}
        {issues.length > 0 && (
          <div className="space-y-2">
            <h4 className={`font-medium ${theme.text}`}>
              {issues.length} Issue{issues.length > 1 ? 's' : ''} Detected:
            </h4>
            {issues.map((issue, idx) => (
              <IssueAlert key={idx} issue={issue} />
            ))}
          </div>
        )}

        {/* Recommendations */}
        {(recommendation === 'poor' || recommendation === 'unusable') && (
          <Alert className="bg-white/70">
            <Info className="h-4 w-4" />
            <AlertTitle>How to Improve Image Quality</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Use good lighting - avoid shadows and glare</li>
                <li>Hold camera steady and ensure the label is in focus</li>
                <li>Take the photo straight-on, not at an angle</li>
                <li>Fill the frame with the label (get closer)</li>
                <li>Use your phone's camera app, not a screenshot</li>
                <li>Make sure all text is clearly readable</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button onClick={onReupload} variant="outline" className="flex-1">
          Upload Better Image
        </Button>
        <Button
          onClick={onProceed}
          variant={recommendation === 'unusable' ? 'destructive' : 'default'}
          className="flex-1"
        >
          {recommendation === 'unusable' ? 'Proceed Anyway (Not Recommended)' : 'Proceed with Analysis'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function IssueAlert({ issue }: { issue: ImageQualityIssue }) {
  const severityColors = {
    critical: 'bg-red-100 border-red-300 text-red-900',
    warning: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    info: 'bg-blue-100 border-blue-300 text-blue-900',
  };

  const severityIcons = {
    critical: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = severityIcons[issue.severity];

  return (
    <Alert className={severityColors[issue.severity]}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-medium">{issue.message}</AlertTitle>
      <AlertDescription className="text-sm mt-1">{issue.suggestion}</AlertDescription>
    </Alert>
  );
}
