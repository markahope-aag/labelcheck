/**
 * useFileUpload Hook
 *
 * Handles file selection, drag-and-drop, preview generation, and image quality checking
 * for the label analysis upload flow.
 *
 * Extracted from app/analyze/page.tsx to improve maintainability and testability.
 */

import { useState, useCallback } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { ImageQualityMetrics } from '@/lib/image-quality';

interface UseFileUploadReturn {
  selectedFile: File | null;
  previewUrl: string;
  isDragging: boolean;
  imageQuality: ImageQualityMetrics | null;
  showQualityWarning: boolean;
  error: string;
  processFile: (file: File) => Promise<void>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  resetFile: () => void;
  clearError: () => void;
  dismissQualityWarning: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [imageQuality, setImageQuality] = useState<ImageQualityMetrics | null>(null);
  const [showQualityWarning, setShowQualityWarning] = useState(false);
  const [error, setError] = useState<string>('');

  /**
   * Process uploaded file: validate, create preview, check quality
   */
  const processFile = useCallback(async (file: File) => {
    clientLogger.debug('Processing file', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    // Accept both images and PDFs
    const isImage = file.type.startsWith('image/');
    const isPdf =
      file.type === 'application/pdf' ||
      file.type === 'application/x-pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    clientLogger.debug('File validation', { isImage, isPdf, fileType: file.type });

    // Validate file type
    if (!isImage && !isPdf) {
      const errorMsg = `Please select a valid image or PDF file (received: ${file.type || 'unknown type'})`;
      clientLogger.error('Invalid file type', { fileType: file.type, fileName: file.name });
      setError(errorMsg);
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // File is valid
    setSelectedFile(file);
    setError('');

    // Create preview for images, skip for PDFs
    if (isPdf) {
      setPreviewUrl(''); // Will show PDF indicator instead
      setImageQuality(null); // PDFs don't need quality check
      setShowQualityWarning(false);
    } else {
      // Create image preview
      setPreviewUrl(URL.createObjectURL(file));

      // Check image quality (don't block upload if this fails)
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const qualityResponse = await fetch('/api/analyze/check-quality', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer as unknown as BodyInit,
        });

        if (qualityResponse.ok) {
          const metrics = await qualityResponse.json();
          setImageQuality(metrics);

          // Show warning if quality is poor or unusable
          if (metrics.recommendation === 'poor' || metrics.recommendation === 'unusable') {
            setShowQualityWarning(true);
          } else if (metrics.recommendation === 'acceptable' && metrics.issues.length >= 2) {
            // Also warn if acceptable but multiple issues
            setShowQualityWarning(true);
          } else {
            setShowQualityWarning(false);
          }
        }
      } catch (error) {
        clientLogger.error('Image quality check failed', { error, fileName: file.name });
        // Don't block upload if quality check fails
        setImageQuality(null);
        setShowQualityWarning(false);
      }
    }
  }, []);

  /**
   * Handle file input change
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set to false if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle file drop event
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      clientLogger.debug('File drop event triggered');
      const files = e.dataTransfer.files;
      clientLogger.debug('Files dropped', { fileCount: files.length });

      if (files && files.length > 0) {
        processFile(files[0]);
      } else {
        clientLogger.warn('No files in drop event');
      }
    },
    [processFile]
  );

  /**
   * Reset file selection
   */
  const resetFile = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl('');
    setImageQuality(null);
    setShowQualityWarning(false);
    setError('');
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError('');
  }, []);

  /**
   * Dismiss quality warning
   * Allows user to proceed with analysis despite quality issues
   */
  const dismissQualityWarning = useCallback(() => {
    setShowQualityWarning(false);
  }, []);

  return {
    selectedFile,
    previewUrl,
    isDragging,
    imageQuality,
    showQualityWarning,
    error,
    processFile,
    handleFileSelect,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    resetFile,
    clearError,
    dismissQualityWarning,
  };
}
