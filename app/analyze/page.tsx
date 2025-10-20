'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AnalyzePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

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
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Analyze Food Label</h1>
            <p className="text-slate-600">Upload a photo of any food label to get instant nutritional insights</p>
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
                      <CardTitle className="text-xl font-semibold text-slate-900">Analysis Results</CardTitle>
                      <CardDescription>AI-powered nutritional insights</CardDescription>
                    </div>
                    <Button onClick={handleReset} variant="outline" className="border-slate-300 hover:bg-slate-50">
                      New Analysis
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {result.product_name && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Product</h3>
                        <p className="text-slate-700">{result.product_name}</p>
                      </div>
                    )}

                    {result.summary && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Summary</h3>
                        <p className="text-slate-700 leading-relaxed">{result.summary}</p>
                      </div>
                    )}

                    {result.ingredients && result.ingredients.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Ingredients</h3>
                        <div className="bg-slate-50 rounded-lg p-4">
                          <p className="text-slate-700">{result.ingredients.join(', ')}</p>
                        </div>
                      </div>
                    )}

                    {result.nutrition_facts && Object.keys(result.nutrition_facts).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Nutrition Facts</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(result.nutrition_facts).map(([key, value]) => (
                            <div key={key} className="bg-slate-50 rounded-lg p-4">
                              <p className="text-sm text-slate-600 capitalize mb-1">{key.replace('_', ' ')}</p>
                              <p className="text-lg font-semibold text-slate-900">{value as string}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.health_score !== undefined && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Health Score</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  result.health_score >= 70
                                    ? 'bg-green-500'
                                    : result.health_score >= 40
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${result.health_score}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-2xl font-bold text-slate-900">{result.health_score}/100</span>
                        </div>
                      </div>
                    )}

                    {result.recommendations && result.recommendations.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Recommendations</h3>
                        <ul className="space-y-2">
                          {result.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-1">•</span>
                              <span className="text-slate-700">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
