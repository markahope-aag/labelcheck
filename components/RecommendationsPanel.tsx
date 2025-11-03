/**
 * RecommendationsPanel Component
 *
 * Displays prioritized compliance recommendations with color-coded urgency indicators.
 *
 * Features:
 * - Automatic sorting by priority (critical > high > medium > low)
 * - Color-coded background and border based on priority
 * - Priority badges with matching colors
 * - Regulation references for each recommendation
 *
 * Extracted from app/analyze/page.tsx for better reusability.
 */

import type { Recommendation } from '@/types';

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  // Sort recommendations by priority
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
  });

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-3 border-b-4 border-slate-400 mt-8">
        Recommendations
      </h3>
      <div className="space-y-3">
        {sortedRecommendations.map((rec: Recommendation, index: number) => (
          <div
            key={index}
            className={`rounded-lg p-4 border-l-4 ${
              rec.priority === 'critical'
                ? 'bg-red-50 border-red-500'
                : rec.priority === 'high'
                  ? 'bg-orange-50 border-orange-500'
                  : rec.priority === 'medium'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  rec.priority === 'critical'
                    ? 'bg-red-200 text-red-900'
                    : rec.priority === 'high'
                      ? 'bg-orange-200 text-orange-900'
                      : rec.priority === 'medium'
                        ? 'bg-yellow-200 text-yellow-900'
                        : 'bg-blue-200 text-blue-900'
                }`}
              >
                {rec.priority}
              </span>
              <div className="flex-1">
                <p className="text-sm text-slate-900 mb-1">{rec.recommendation}</p>
                <p className="text-xs text-slate-600">{rec.regulation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
