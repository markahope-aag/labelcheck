/**
 * useAnalysisSession Hook
 *
 * Handles analysis session features: sharing, chat, text checking, and comparison viewing.
 * Extracted from app/analyze/page.tsx to improve maintainability and testability.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { clientLogger } from '@/lib/client-logger';
import type { CreateShareLinkResponse } from '@/types';

interface UseAnalysisSessionReturn {
  // Share dialog state
  shareDialogOpen: boolean;
  shareUrl: string;
  copied: boolean;
  openShareDialog: (analysisId: string) => Promise<void>;
  closeShareDialog: () => void;
  copyShareUrl: () => void;

  // Chat state
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;

  // Text checker state
  isTextCheckerOpen: boolean;
  openTextChecker: () => void;
  closeTextChecker: () => void;

  // Comparison state
  showComparison: boolean;
  openComparison: () => void;
  closeComparison: () => void;
}

export function useAnalysisSession(): UseAnalysisSessionReturn {
  const { toast } = useToast();

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Text checker state
  const [isTextCheckerOpen, setIsTextCheckerOpen] = useState(false);

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);

  /**
   * Open share dialog and generate share link
   */
  const openShareDialog = useCallback(
    async (analysisId: string) => {
      try {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate share link');
        }

        const data: CreateShareLinkResponse = await response.json();
        setShareUrl(data.shareUrl);
        setShareDialogOpen(true);
        setCopied(false);
      } catch (error) {
        clientLogger.error('Failed to generate share link', { error, analysisId });
        toast({
          title: 'Error',
          description: 'Failed to generate share link. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  /**
   * Close share dialog
   */
  const closeShareDialog = useCallback(() => {
    setShareDialogOpen(false);
    setCopied(false);
  }, []);

  /**
   * Copy share URL to clipboard
   */
  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: 'Link copied!',
      description: 'Share link has been copied to clipboard.',
    });

    // Reset copied state after 3 seconds
    setTimeout(() => setCopied(false), 3000);
  }, [shareUrl, toast]);

  /**
   * Open chat panel
   */
  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  /**
   * Close chat panel
   */
  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  /**
   * Open text checker panel
   */
  const openTextChecker = useCallback(() => {
    setIsTextCheckerOpen(true);
  }, []);

  /**
   * Close text checker panel
   */
  const closeTextChecker = useCallback(() => {
    setIsTextCheckerOpen(false);
  }, []);

  /**
   * Open category comparison view
   */
  const openComparison = useCallback(() => {
    setShowComparison(true);
  }, []);

  /**
   * Close category comparison view
   */
  const closeComparison = useCallback(() => {
    setShowComparison(false);
  }, []);

  return {
    // Share
    shareDialogOpen,
    shareUrl,
    copied,
    openShareDialog,
    closeShareDialog,
    copyShareUrl,

    // Chat
    isChatOpen,
    openChat,
    closeChat,

    // Text checker
    isTextCheckerOpen,
    openTextChecker,
    closeTextChecker,

    // Comparison
    showComparison,
    openComparison,
    closeComparison,
  };
}
