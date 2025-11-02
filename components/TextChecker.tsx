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
  const [uploadMode, setUploadMode] = useState<'text' | 'pdf'>('text');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (uploadMode === 'text' && !textContent.trim()) return;
    if (uploadMode === 'pdf' && !selectedPdf) return;
    if (isAnalyzing) return;

    setIsAnalyzing(true);

    try {
      let response;

      if (uploadMode === 'pdf' && selectedPdf) {
        // Send PDF file to the text analysis endpoint
        const formData = new FormData();
        formData.append('pdf', selectedPdf);
        formData.append('sessionId', sessionId);

        response = await fetch('/api/analyze/text', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Send plain text
        response = await fetch('/api/analyze/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            textContent: textContent.trim(),
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze content');
      }

      toast({
        title: 'Analysis Complete',
        description:
          uploadMode === 'pdf'
            ? 'Your PDF has been analyzed for compliance'
            : 'Your text content has been analyzed for compliance',
      });

      onAnalysisComplete(data);
      onClose();
    } catch (error: any) {
      console.error('Error analyzing content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to analyze content',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid File',
          description: 'Please select a PDF file',
          variant: 'destructive',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'PDF must be less than 10MB',
          variant: 'destructive',
        });
        return;
      }
      setSelectedPdf(file);
    }
  };

  const handleLoadExample = () => {
    setTextContent(
      'Product Name: Organic Ground Coffee\nNet Weight: 12 oz (340g)\n\nIngredients: 100% Arabica Coffee Beans\n\nDistributed by:\nExample Coffee Company\n123 Main Street\nSeattle, WA 98101\n\nCertified Organic by USDA\nFair Trade Certified'
    );
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
          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => {
                setUploadMode('text');
                setSelectedPdf(null);
              }}
              disabled={isAnalyzing}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
                uploadMode === 'text'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="inline h-4 w-4 mr-2" />
              Paste Text
            </button>
            <button
              onClick={() => {
                setUploadMode('pdf');
                setTextContent('');
              }}
              disabled={isAnalyzing}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
                uploadMode === 'pdf'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="inline h-4 w-4 mr-2" />
              Upload PDF
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              How This Works
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              {uploadMode === 'text' ? (
                <>
                  <li>• Paste your proposed label text below</li>
                  <li>• We'll check it against FDA/USDA regulations</li>
                  <li>• Compare results to your original image analysis</li>
                  <li>• See what issues are resolved and what remains</li>
                </>
              ) : (
                <>
                  <li>• Upload a PDF of your proposed label design</li>
                  <li>• AI will read the text from the PDF (handles complex layouts)</li>
                  <li>• Checks compliance against FDA/USDA regulations</li>
                  <li>• Compares to your original analysis to show improvement</li>
                </>
              )}
            </ul>
          </div>

          {uploadMode === 'text' ? (
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
                placeholder="Enter your proposed label text here, for example:\n\nProduct Name: Organic Coffee\nNet Weight: 12 oz (340g)\nIngredients: 100% Arabica Coffee Beans\nDistributed by: Your Company Name\nAddress: City, State ZIP\n\nInclude all elements you plan to put on the label:\n- Product name\n- Net quantity\n- Ingredients list\n- Allergen information (if applicable)\n- Manufacturer/distributor name and address\n- Any claims or certifications"
                className="min-h-[300px] font-mono text-sm"
                disabled={isAnalyzing}
              />
              <p className="text-xs text-slate-500">
                Enter all the text content you plan to include on your label. The more complete the
                information, the more accurate the analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfSelect}
                  className="hidden"
                  id="pdf-upload"
                  disabled={isAnalyzing}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  {selectedPdf ? (
                    <div className="flex flex-col items-center">
                      <FileText className="h-12 w-12 text-green-600 mb-3" />
                      <p className="font-semibold text-slate-900 mb-1">{selectedPdf.name}</p>
                      <p className="text-sm text-slate-600">
                        {(selectedPdf.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedPdf(null);
                        }}
                        disabled={isAnalyzing}
                      >
                        Remove File
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="p-4 bg-green-100 rounded-full mb-4">
                        <Upload className="h-8 w-8 text-green-600" />
                      </div>
                      <p className="text-lg font-medium text-slate-900 mb-2">Click to upload PDF</p>
                      <p className="text-sm text-slate-500">
                        PDF up to 10MB • AI will extract and analyze text
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Complex Text Recognition
                </h4>
                <p className="text-sm text-green-800 mb-2">
                  Our AI can read PDFs with complex label designs:
                </p>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Text in various orientations (rotated, vertical, etc.)</li>
                  <li>• Small fonts and ingredient lists</li>
                  <li>• Text on complex backgrounds</li>
                  <li>• Multiple colors and fonts</li>
                  <li>• Poor contrast or faded text</li>
                </ul>
              </div>
            </div>
          )}

          {uploadMode === 'text' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Note About Text-Only Analysis
              </h4>
              <p className="text-sm text-yellow-800">
                This analyzes content compliance only. Visual elements like font size, placement,
                and prominence cannot be evaluated from text alone. For complete validation, you'll
                still need to analyze the final label image.
              </p>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 bg-slate-50">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isAnalyzing}>
              Cancel
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={
                (uploadMode === 'text' && !textContent.trim()) ||
                (uploadMode === 'pdf' && !selectedPdf) ||
                isAnalyzing
              }
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
                  {uploadMode === 'pdf' ? 'Analyze PDF' : 'Analyze Text'}
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
