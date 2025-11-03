/**
 * AnalysisUploadForm Component
 *
 * Handles the file upload UI for label analysis, including:
 * - Drag-and-drop file upload
 * - File preview (images and PDFs)
 * - Image quality warnings
 * - Label name input
 * - Analysis progress indicator
 * - Tips for best results
 *
 * Extracted from app/analyze/page.tsx for better maintainability.
 */

import { Camera, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageQualityWarning } from '@/components/ImageQualityWarning';
import type { ImageQualityMetrics } from '@/lib/image-quality';

interface AnalysisUploadFormProps {
  // File upload state
  selectedFile: File | null;
  previewUrl: string;
  isDragging: boolean;
  imageQuality: ImageQualityMetrics | null;
  showQualityWarning: boolean;

  // Analysis state
  isRevisedMode: boolean;
  isAnalyzing: boolean;
  analysisStep: string;
  analysisProgress: number;

  // Label name state
  labelName: string;
  onLabelNameChange: (name: string) => void;

  // File upload handlers
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDismissQualityWarning: () => void;
  onReupload: () => void;

  // Analysis handlers
  onAnalyze: () => void;
  onReset: () => void;
}

export function AnalysisUploadForm({
  selectedFile,
  previewUrl,
  isDragging,
  imageQuality,
  showQualityWarning,
  isRevisedMode,
  isAnalyzing,
  analysisStep,
  analysisProgress,
  labelName,
  onLabelNameChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelect,
  onDismissQualityWarning,
  onReupload,
  onAnalyze,
  onReset,
}: AnalysisUploadFormProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-slate-900">
          {isRevisedMode ? 'Upload Revised Label' : 'Upload Image'}
        </CardTitle>
        <CardDescription>
          {isRevisedMode
            ? 'Upload your updated label to see the improvements'
            : 'Upload your complete product label as a photo, image file (PNG, JPG, BMP), or PDF (all panels)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {!selectedFile ? (
            <div
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
              }`}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={onFileSelect}
                className="hidden"
                id="file-upload"
              />
              <div className="flex flex-col items-center pointer-events-none">
                <div
                  className={`p-4 rounded-full mb-4 transition-colors ${
                    isDragging ? 'bg-blue-200' : 'bg-blue-100'
                  }`}
                >
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="font-semibold text-slate-900 mb-1">{selectedFile.name}</p>
                    <p className="text-sm text-slate-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <p className="text-xs text-slate-500 mt-2">PDF ready for analysis</p>
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    loading="lazy"
                    className="w-full h-auto max-h-96 object-contain bg-slate-50"
                  />
                )}
              </div>

              {/* Image Quality Warning */}
              {showQualityWarning && imageQuality && (
                <ImageQualityWarning
                  metrics={imageQuality}
                  onProceed={onDismissQualityWarning}
                  onReupload={onReupload}
                />
              )}

              {/* Label Name Input */}
              <div className="space-y-2">
                <label htmlFor="label-name" className="text-sm font-medium text-slate-700">
                  Label Name (Optional)
                </label>
                <Input
                  id="label-name"
                  type="text"
                  placeholder="e.g., Cold Brew Coffee - Original"
                  value={labelName}
                  onChange={(e) => onLabelNameChange(e.target.value)}
                  className="w-full"
                  disabled={isAnalyzing}
                />
                <p className="text-xs text-slate-500">
                  Give this label a name to help you organize and find it later in your history
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={onAnalyze}
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
                  onClick={onReset}
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
                    <span className="text-sm font-medium text-blue-900">{analysisStep}</span>
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
  );
}
