/**
 * useComparisonCalculator Hook
 *
 * Calculates comparison metrics between two analysis results (before/after revisions).
 * Shows improvement statistics for revision tracking workflow.
 *
 * Extracted from app/analyze/page.tsx to improve maintainability.
 */

import { useMemo } from 'react';
import type { AnalyzeImageResponse, LabelingSection } from '@/types';

interface ComparisonResult {
  prevStatus: string;
  currStatus: string;
  prevIssues: number;
  currIssues: number;
  improvement: number;
  statusImproved: boolean;
}

/**
 * Calculate comparison between previous and current analysis results
 */
export function useComparisonCalculator(
  previousResult: AnalyzeImageResponse | null,
  currentResult: AnalyzeImageResponse | null
): ComparisonResult | null {
  return useMemo(() => {
    if (!previousResult || !currentResult) {
      return null;
    }

    const prevStatus = previousResult.overall_assessment?.primary_compliance_status || '';
    const currStatus = currentResult.overall_assessment?.primary_compliance_status || '';

    // Count issues by severity in previous result
    const prevIssues = {
      critical: 0,
      warning: 0,
      compliant: 0,
    };

    // Count issues by severity in current result
    const currIssues = {
      critical: 0,
      warning: 0,
      compliant: 0,
    };

    /**
     * Helper to count issues from a section
     */
    const countIssuesInSection = (
      section: LabelingSection | Record<string, LabelingSection | undefined> | undefined,
      counters: { critical: number; warning: number; compliant: number }
    ) => {
      if (!section) return;

      // Handle direct LabelingSection
      if ('status' in section && typeof section === 'object' && !Array.isArray(section)) {
        const status = (section as LabelingSection).status;
        if (status === 'non_compliant') counters.critical++;
        else if (status === 'potentially_non_compliant') counters.warning++;
        else if (status === 'compliant') counters.compliant++;
      } else if (typeof section === 'object') {
        // Handle Record<string, LabelingSection | undefined>
        Object.values(section).forEach((item) => {
          if (item && item.status) {
            if (item.status === 'non_compliant') counters.critical++;
            else if (item.status === 'potentially_non_compliant') counters.warning++;
            else if (item.status === 'compliant') counters.compliant++;
          }
        });
      }
    };

    // Count issues in both results
    [previousResult, currentResult].forEach((res, idx) => {
      const counters = idx === 0 ? prevIssues : currIssues;

      // Count from general_labeling (which is an object with sub-sections)
      if (res?.general_labeling) {
        Object.values(res.general_labeling).forEach((section: unknown) => {
          if (section && typeof section === 'object' && 'status' in section) {
            const typedSection = section as { status: string };
            if (typedSection.status === 'non_compliant') counters.critical++;
            else if (typedSection.status === 'potentially_non_compliant') counters.warning++;
            else if (typedSection.status === 'compliant') counters.compliant++;
          }
        });
      }

      // Count from nutrition_labeling (optional)
      if (res.nutrition_labeling && res.nutrition_labeling.status) {
        if (res.nutrition_labeling.status === 'non_compliant') counters.critical++;
        else if (res.nutrition_labeling.status === 'potentially_non_compliant') counters.warning++;
        else if (res.nutrition_labeling.status === 'compliant') counters.compliant++;
      }

      // Count from allergen_labeling
      if (res.allergen_labeling && res.allergen_labeling.status) {
        if (res.allergen_labeling.status === 'non_compliant') counters.critical++;
        else if (res.allergen_labeling.status === 'potentially_non_compliant') counters.warning++;
        else if (res.allergen_labeling.status === 'compliant') counters.compliant++;
      }

      // Claims are structured differently, skip for now
    });

    const prevTotal = prevIssues.critical + prevIssues.warning;
    const currTotal = currIssues.critical + currIssues.warning;
    const improvement = prevTotal - currTotal;

    return {
      prevStatus,
      currStatus,
      prevIssues: prevTotal,
      currIssues: currTotal,
      improvement,
      statusImproved:
        prevStatus !== currStatus &&
        (currStatus === 'compliant' || currStatus === 'likely_compliant'),
    };
  }, [previousResult, currentResult]);
}
