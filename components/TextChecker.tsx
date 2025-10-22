'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TextCheckerProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (result: any) => void;
}

export function TextChecker({ sessionId, isOpen, onClose, onAnalysisComplete }: TextCheckerProps) {
  const [textContent, setTextContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!textContent.trim() || isAnalyzing) return;

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          textContent: textContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze text');
      }

      toast({
        title: 'Analysis Complete',
        description: 'Your text content has been analyzed for compliance',
      });

      onAnalysisComplete(data);
      onClose();
    } catch (error: any) {
      console.error('Error analyzing text:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to analyze text content',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadExample = () => {
    setTextContent(`Product Name: Organic Ground Coffee
Net Weight: 12 oz (340g)

Ingredients: 100% Arabica Coffee Beans

Distributed by:
Example Coffee Company
123 Main Street
Seattle, WA 98101

Certified Organic by USDA
Fair Trade Certified`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Check Alternative Text</CardTitle>
                <CardDescription>
                  Test prospective label content before creating physical mockups
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isAnalyzing}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              How This Works
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Paste your proposed label text below</li>
              <li>• We'll check it against FDA/USDA regulations</li>
              <li>• Compare results to your original image analysis</li>
              <li>• See what issues are resolved and what remains</li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-900">
                Prospective Label Content
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadExample}
                disabled={isAnalyzing}
                className="text-xs"
              >
                Load Example
              </Button>
            </div>
            <Textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={`Enter your proposed label text here, for example:

Product Name: Organic Coffee
Net Weight: 12 oz (340g)
Ingredients: 100% Arabica Coffee Beans
Distributed by: Your Company Name
Address: City, State ZIP

Include all elements you plan to put on the label:
- Product name
- Net quantity
- Ingredients list
- Allergen information (if applicable)
- Manufacturer/distributor name and address
- Any claims or certifications`}
              className="min-h-[300px] font-mono text-sm"
              disabled={isAnalyzing}
            />
            <p className="text-xs text-slate-500">
              Enter all the text content you plan to include on your label. The more complete the information, the more accurate the analysis.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Note About Text-Only Analysis
            </h4>
            <p className="text-sm text-yellow-800">
              This analyzes content compliance only. Visual elements like font size, placement, and prominence cannot be evaluated from text alone. For complete validation, you'll still need to analyze the final label image.
            </p>
          </div>
        </CardContent>

        <div className="border-t p-4 bg-slate-50">
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isAnalyzing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={!textContent.trim() || isAnalyzing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Analyze Text
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Analysis will be saved to this session for comparison
          </p>
        </div>
      </Card>
    </div>
  );
}
