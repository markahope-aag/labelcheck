'use client';

import { useState } from 'react';
import { ProductCategory } from '@/lib/supabase';
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface CategoryOption {
  category: ProductCategory;
  isAIDetected: boolean;
  currentLabelCompliant: boolean;
  requiredChanges: string[];
  allowedClaims: string[];
  prohibitedClaims: string[];
  regulatoryRequirements: string[];
  pros: string[];
  cons: string[];
}

interface LabelConflict {
  severity: 'critical' | 'high' | 'medium' | 'low';
  conflict: string;
  current_category: string;
  violation: string;
}

interface CategorySelectorProps {
  aiCategory: ProductCategory;
  confidence: 'high' | 'medium' | 'low';
  categoryRationale: string;
  alternatives: ProductCategory[];
  categoryOptions: Record<string, any>;
  labelConflicts?: LabelConflict[];
  recommendation?: {
    suggested_category: ProductCategory;
    confidence: string;
    reasoning: string;
    key_decision_factors: string[];
  };
  onSelect: (category: ProductCategory, reason?: string) => void;
  onCompare: () => void;
}

const CATEGORY_DISPLAY_NAMES: Record<ProductCategory, string> = {
  CONVENTIONAL_FOOD: 'Conventional Food',
  DIETARY_SUPPLEMENT: 'Dietary Supplement',
  ALCOHOLIC_BEVERAGE: 'Alcoholic Beverage',
  NON_ALCOHOLIC_BEVERAGE: 'Non-Alcoholic Beverage',
};

const CATEGORY_DESCRIPTIONS: Record<ProductCategory, string> = {
  CONVENTIONAL_FOOD: 'Standard packaged foods regulated by FDA under 21 CFR Part 101',
  DIETARY_SUPPLEMENT: 'Products regulated under DSHEA (Dietary Supplement Health and Education Act)',
  ALCOHOLIC_BEVERAGE: 'Products containing ≥0.5% ABV regulated by TTB',
  NON_ALCOHOLIC_BEVERAGE: 'Ready-to-drink beverages for refreshment/hydration',
};

export default function CategorySelector({
  aiCategory,
  confidence,
  categoryRationale,
  alternatives,
  categoryOptions,
  labelConflicts = [],
  recommendation,
  onSelect,
  onCompare,
}: CategorySelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<ProductCategory | null>(aiCategory);
  const [showCustomReason, setShowCustomReason] = useState(false);
  const [customReason, setCustomReason] = useState('');

  const hasAlternatives = alternatives && alternatives.length > 0;
  const hasConflicts = labelConflicts && labelConflicts.length > 0;

  const getCategoryColor = (category: ProductCategory, isSelected: boolean) => {
    if (isSelected) return 'border-blue-500 bg-blue-50';
    if (recommendation && recommendation.suggested_category === category) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-gray-300 bg-white';
  };

  const getConfidenceBadge = (conf: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };
    return colors[conf as keyof typeof colors] || colors.medium;
  };

  const buildCategoryOption = (category: ProductCategory): CategoryOption => {
    const optionData = categoryOptions[category] || {};
    return {
      category,
      isAIDetected: category === aiCategory,
      currentLabelCompliant: optionData.current_label_compliant ?? false,
      requiredChanges: optionData.required_changes || [],
      allowedClaims: optionData.allowed_claims || [],
      prohibitedClaims: optionData.prohibited_claims || [],
      regulatoryRequirements: optionData.regulatory_requirements || [],
      pros: optionData.pros || [],
      cons: optionData.cons || [],
    };
  };

  const allCategories: ProductCategory[] = [aiCategory, ...(alternatives || [])];
  const categoryOptionsData = allCategories.map(buildCategoryOption);

  return (
    <div className="bg-white rounded-lg border-2 border-orange-400 p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Category Selection Needed</h2>
          <p className="text-gray-600 mt-1">
            This product could be classified in multiple ways. Please select how you intend to market it.
          </p>
        </div>
      </div>

      {/* AI Detection Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-blue-900">AI Detected Category</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBadge(confidence)}`}>
            {confidence.toUpperCase()} Confidence ({confidence === 'high' ? '90%+' : confidence === 'medium' ? '60-89%' : '<60%'})
          </span>
        </div>
        <p className="text-sm text-blue-800">
          <span className="font-medium">{CATEGORY_DISPLAY_NAMES[aiCategory]}</span>
          {' — '}{categoryRationale}
        </p>
      </div>

      {/* Label Conflicts (if any) */}
      {hasConflicts && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-900">Label Configuration Issues</span>
          </div>
          <ul className="space-y-2">
            {labelConflicts.map((conflict, idx) => (
              <li key={idx} className="text-sm text-red-800">
                <span className="font-medium">{conflict.severity.toUpperCase()}:</span> {conflict.conflict}
                <br />
                <span className="text-red-600 text-xs">{conflict.violation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation (if provided) */}
      {recommendation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-900">Our Recommendation</span>
          </div>
          <p className="text-sm text-green-800 mb-2">
            <span className="font-medium">{CATEGORY_DISPLAY_NAMES[recommendation.suggested_category]}</span>
          </p>
          <p className="text-sm text-green-700 mb-2">{recommendation.reasoning}</p>
          {recommendation.key_decision_factors && recommendation.key_decision_factors.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-green-800">Key factors:</span>
              <ul className="list-disc list-inside text-xs text-green-700 mt-1">
                {recommendation.key_decision_factors.map((factor, idx) => (
                  <li key={idx}>{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category Options */}
      <div className="space-y-4 mb-6">
        <h3 className="font-semibold text-gray-900">How do you want to market this product?</h3>

        {categoryOptionsData.map((option) => (
          <div
            key={option.category}
            className={`border-2 rounded-lg p-4 transition-all ${getCategoryColor(option.category, expandedCategory === option.category)}`}
          >
            {/* Category Header */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedCategory(expandedCategory === option.category ? null : option.category)}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="category"
                  value={option.category}
                  className="w-4 h-4"
                  onChange={() => {}}
                />
                <div>
                  <div className="font-semibold text-gray-900">{CATEGORY_DISPLAY_NAMES[option.category]}</div>
                  <div className="text-xs text-gray-600">{CATEGORY_DESCRIPTIONS[option.category]}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {option.isAIDetected && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">AI Detected</span>
                )}
                {recommendation && recommendation.suggested_category === option.category && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Recommended</span>
                )}
                {expandedCategory === option.category ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedCategory === option.category && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                {/* Compliance Status */}
                <div>
                  <span className="text-sm font-medium text-gray-700">Current Label Status:</span>
                  <div className={`inline-flex items-center gap-1 ml-2 text-sm ${option.currentLabelCompliant ? 'text-green-600' : 'text-red-600'}`}>
                    {option.currentLabelCompliant ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {option.currentLabelCompliant ? 'Compliant' : 'Needs Changes'}
                  </div>
                </div>

                {/* Required Changes */}
                {option.requiredChanges.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Required Changes:</span>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                      {option.requiredChanges.map((change, idx) => (
                        <li key={idx}>{change}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pros */}
                {option.pros.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-green-700">✓ Advantages:</span>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                      {option.pros.map((pro, idx) => (
                        <li key={idx}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cons */}
                {option.cons.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-red-700">✗ Restrictions:</span>
                    <ul className="list-disc list-inside text-sm text-gray-600 mt-1 space-y-1">
                      {option.cons.map((con, idx) => (
                        <li key={idx}>{con}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Allowed/Prohibited Claims */}
                <div className="grid grid-cols-2 gap-4">
                  {option.allowedClaims.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-700">What You CAN Say:</span>
                      <ul className="list-disc list-inside text-xs text-gray-600 mt-1 space-y-0.5">
                        {option.allowedClaims.slice(0, 3).map((claim, idx) => (
                          <li key={idx}>{claim}</li>
                        ))}
                        {option.allowedClaims.length > 3 && (
                          <li className="text-gray-500">+{option.allowedClaims.length - 3} more...</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {option.prohibitedClaims.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-700">What You CANNOT Say:</span>
                      <ul className="list-disc list-inside text-xs text-gray-600 mt-1 space-y-0.5">
                        {option.prohibitedClaims.slice(0, 3).map((claim, idx) => (
                          <li key={idx}>{claim}</li>
                        ))}
                        {option.prohibitedClaims.length > 3 && (
                          <li className="text-gray-500">+{option.prohibitedClaims.length - 3} more...</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Select Button */}
                <button
                  onClick={() => {
                    if (option.category !== aiCategory) {
                      setShowCustomReason(true);
                    } else {
                      onSelect(option.category);
                    }
                  }}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Select {CATEGORY_DISPLAY_NAMES[option.category]}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => onSelect(aiCategory)}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Skip - Use AI Recommendation ({CATEGORY_DISPLAY_NAMES[aiCategory]})
        </button>

        {hasAlternatives && (
          <button
            onClick={onCompare}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Compare All Options Side-by-Side
          </button>
        )}
      </div>

      {/* Custom Reason Modal */}
      {showCustomReason && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">Why are you choosing a different category?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This helps us improve our recommendations and understand your needs better.
            </p>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g., 'I want to make health claims' or 'I prefer simpler regulations'"
              className="w-full border border-gray-300 rounded p-2 text-sm h-24 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCustomReason(false);
                  setCustomReason('');
                }}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selectedCategory = categoryOptionsData.find(opt => expandedCategory === opt.category)?.category;
                  if (selectedCategory) {
                    onSelect(selectedCategory, customReason || undefined);
                  }
                  setShowCustomReason(false);
                  setCustomReason('');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
