/**
 * useAnalysis Hook
 *
 * Handles label analysis state, API calls, progress tracking, and result management.
 * Extracted from app/analyze/page.tsx to improve maintainability and testability.
 */

import { useState, useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { AnalyzeImageResponse, APIError } from '@/types';

interface UseAnalysisProps {
  userId: string | null | undefined;
  onSuccess?: (result: AnalyzeImageResponse) => void;
  onError?: (error: string, code: string) => void;
}

interface UseAnalysisReturn {
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStep: string;
  result: AnalyzeImageResponse | null;
  error: string;
  errorCode: string;
  sessionId: string | null;
  isRevisedMode: boolean;
  previousResult: AnalyzeImageResponse | null;
  showCategorySelector: boolean;
  analysisData: AnalyzeImageResponse | null;
  analyzeLabel: (file: File, labelName?: string) => Promise<void>;
  setResult: (result: AnalyzeImageResponse | null) => void;
  setSessionId: (id: string | null) => void;
  enterRevisedMode: () => void;
  exitRevisedMode: () => void;
  handleCategorySelection: () => void;
  clearError: () => void;
  reset: () => void;
  // Manual state control methods for complex orchestration flows
  showCategorySelectorUI: () => void;
  hideCategorySelectorUI: () => void;
  updateAnalysisData: (data: AnalyzeImageResponse | null) => void;
  setAnalyzingState: (isAnalyzing: boolean) => void;
  setErrorState: (error: string, errorCode?: string) => void;
}

export function useAnalysis({ userId, onSuccess, onError }: UseAnalysisProps): UseAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [result, setResult] = useState<AnalyzeImageResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRevisedMode, setIsRevisedMode] = useState(false);
  const [previousResult, setPreviousResult] = useState<AnalyzeImageResponse | null>(null);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalyzeImageResponse | null>(null);

  /**
   * Analyze a label image or PDF
   */
  const analyzeLabel = useCallback(
    async (file: File, labelName?: string) => {
      if (!userId) {
        setError('You must be logged in to analyze labels');
        return;
      }

      setIsAnalyzing(true);
      setError('');
      setErrorCode('');
      setAnalysisProgress(0);
      setAnalysisStep('Uploading file...');

      const startTime = Date.now();

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          const elapsed = Date.now() - startTime;
          const elapsedSeconds = Math.floor(elapsed / 1000);

          if (prev < 98) {
            const increment = prev < 90 ? Math.random() * 3 + 1 : Math.random() * 0.5 + 0.1;
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
        formData.append('image', file);

        if (labelName?.trim()) {
          formData.append('labelName', labelName.trim());
        }

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

        const data: AnalyzeImageResponse | APIError = await response.json();

        if (!response.ok) {
          const errorData = data as APIError & { metadata?: { current?: number; limit?: number } };
          const errorMessage = errorData.error || 'Failed to analyze label';
          const code = errorData.code || '';

          setError(errorMessage);
          setErrorCode(code);

          // Handle specific error codes
          if (errorData.code === 'RATE_LIMIT' && errorData.metadata) {
            const { current, limit } = errorData.metadata;
            if (current !== undefined && limit !== undefined) {
              setError(`${errorData.error} (${current}/${limit} analyses used)`);
            }
          }

          onError?.(errorMessage, code);
          return;
        }

        const responseData = data as AnalyzeImageResponse;

        // Store session ID
        if (responseData.session?.id) {
          setSessionId(responseData.session.id);
        }

        // Check if category selector should be shown
        if (responseData.show_category_selector) {
          setAnalysisData(responseData);
          setShowCategorySelector(true);
          // Don't set result yet - wait for category selection
        } else {
          setResult(responseData);
          setShowCategorySelector(false);
          onSuccess?.(responseData);
        }

        // Exit revised mode if this was a revision
        if (isRevisedMode) {
          setIsRevisedMode(false);
        }
      } catch (err: unknown) {
        clearInterval(progressInterval);
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred while analyzing the image';
        setError(errorMessage);
        setErrorCode('');
        clientLogger.error('Analysis failed', { error: err });
        onError?.(errorMessage, '');
      } finally {
        setIsAnalyzing(false);
        clearInterval(progressInterval);
      }
    },
    [userId, sessionId, isRevisedMode, onSuccess, onError]
  );

  /**
   * Enter revised mode for uploading improved labels
   */
  const enterRevisedMode = useCallback(() => {
    if (result) {
      setPreviousResult(result);
      setResult(null);
      setIsRevisedMode(true);
    }
  }, [result]);

  /**
   * Exit revised mode
   */
  const exitRevisedMode = useCallback(() => {
    setIsRevisedMode(false);
    setPreviousResult(null);
  }, []);

  /**
   * Handle category selection completion
   */
  const handleCategorySelection = useCallback(() => {
    if (analysisData) {
      setResult(analysisData);
      setShowCategorySelector(false);
      onSuccess?.(analysisData);
    }
  }, [analysisData, onSuccess]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError('');
    setErrorCode('');
  }, []);

  /**
   * Reset all analysis state
   */
  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setAnalysisStep('');
    setResult(null);
    setError('');
    setErrorCode('');
    setSessionId(null);
    setIsRevisedMode(false);
    setPreviousResult(null);
    setShowCategorySelector(false);
    setAnalysisData(null);
  }, []);

  /**
   * Manual state control methods for complex orchestration flows
   * These methods allow the page to directly manipulate internal state
   * when the hook's automatic state management isn't sufficient
   */

  const showCategorySelectorUI = useCallback(() => {
    setShowCategorySelector(true);
  }, []);

  const hideCategorySelectorUI = useCallback(() => {
    setShowCategorySelector(false);
  }, []);

  const updateAnalysisData = useCallback((data: AnalyzeImageResponse | null) => {
    setAnalysisData(data);
  }, []);

  const setAnalyzingState = useCallback((analyzing: boolean) => {
    setIsAnalyzing(analyzing);
  }, []);

  const setErrorState = useCallback((errorMessage: string, code: string = '') => {
    setError(errorMessage);
    setErrorCode(code);
  }, []);

  return {
    isAnalyzing,
    analysisProgress,
    analysisStep,
    result,
    error,
    errorCode,
    sessionId,
    isRevisedMode,
    previousResult,
    showCategorySelector,
    analysisData,
    analyzeLabel,
    setResult,
    setSessionId,
    enterRevisedMode,
    exitRevisedMode,
    handleCategorySelection,
    clearError,
    reset,
    showCategorySelectorUI,
    hideCategorySelectorUI,
    updateAnalysisData,
    setAnalyzingState,
    setErrorState,
  };
}
