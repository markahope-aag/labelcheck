'use client';

import { ProductCategory } from '@/lib/supabase';
import { CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

interface CategoryComparisonProps {
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
  onSelect: (category: ProductCategory) => void;
  onBack: () => void;
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

export default function CategoryComparison({
  aiCategory,
  confidence,
  categoryRationale,
  alternatives,
  categoryOptions,
  labelConflicts = [],
  recommendation,
  onSelect,
  onBack,
}: CategoryComparisonProps) {
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

  const getCategoryBorderColor = (category: ProductCategory) => {
    if (recommendation && recommendation.suggested_category === category) {
      return 'border-green-500';
    }
    if (category === aiCategory) {
      return 'border-blue-500';
    }
    return 'border-gray-300';
  };

  return (
    <div className="bg-white rounded-lg border-2 border-purple-400 p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Category Comparison</h2>
          <p className="text-gray-600 mt-1">
            Compare all options side-by-side to make the best choice for your product.
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Selection
        </Button>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <div className="grid gap-4 min-w-[800px]" style={{ gridTemplateColumns: `repeat(${categoryOptionsData.length}, 1fr)` }}>
          {categoryOptionsData.map((option) => (
            <div
              key={option.category}
              className={`border-2 rounded-lg ${getCategoryBorderColor(option.category)} bg-white`}
            >
              {/* Category Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="font-bold text-lg text-gray-900 mb-1">
                  {CATEGORY_DISPLAY_NAMES[option.category]}
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  {CATEGORY_DESCRIPTIONS[option.category]}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {option.isAIDetected && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      AI Detected
                    </span>
                  )}
                  {recommendation && recommendation.suggested_category === option.category && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Recommended
                    </span>
                  )}
                </div>

                {/* Compliance Status */}
                <div className={`flex items-center gap-2 text-sm font-medium ${option.currentLabelCompliant ? 'text-green-600' : 'text-red-600'}`}>
                  {option.currentLabelCompliant ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {option.currentLabelCompliant ? 'Current Label Compliant' : 'Requires Label Changes'}
                </div>
              </div>

              {/* Category Details */}
              <div className="p-4 space-y-4">
                {/* Required Changes */}
                {option.requiredChanges.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-2">📋 Required Changes:</h4>
                    <ul className="space-y-1">
                      {option.requiredChanges.map((change, idx) => (
                        <li key={idx} className="text-xs text-gray-700 pl-3 border-l-2 border-red-300">
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pros */}
                {option.pros.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-2">✓ Advantages:</h4>
                    <ul className="space-y-1">
                      {option.pros.map((pro, idx) => (
                        <li key={idx} className="text-xs text-gray-700 pl-3 border-l-2 border-green-300">
                          {pro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cons */}
                {option.cons.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-2">✗ Restrictions:</h4>
                    <ul className="space-y-1">
                      {option.cons.map((con, idx) => (
                        <li key={idx} className="text-xs text-gray-700 pl-3 border-l-2 border-red-300">
                          {con}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Allowed Claims */}
                {option.allowedClaims.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-blue-700 mb-2">✓ What You CAN Say:</h4>
                    <ul className="space-y-1">
                      {option.allowedClaims.slice(0, 5).map((claim, idx) => (
                        <li key={idx} className="text-xs text-gray-700 pl-3 border-l-2 border-blue-300">
                          {claim}
                        </li>
                      ))}
                      {option.allowedClaims.length > 5 && (
                        <li className="text-xs text-gray-500 pl-3">
                          +{option.allowedClaims.length - 5} more claims...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Prohibited Claims */}
                {option.prohibitedClaims.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-orange-700 mb-2">✗ What You CANNOT Say:</h4>
                    <ul className="space-y-1">
                      {option.prohibitedClaims.slice(0, 5).map((claim, idx) => (
                        <li key={idx} className="text-xs text-gray-700 pl-3 border-l-2 border-orange-300">
                          {claim}
                        </li>
                      ))}
                      {option.prohibitedClaims.length > 5 && (
                        <li className="text-xs text-gray-500 pl-3">
                          +{option.prohibitedClaims.length - 5} more restrictions...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Regulatory Requirements */}
                {option.regulatoryRequirements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">📜 Key Regulations:</h4>
                    <ul className="space-y-1">
                      {option.regulatoryRequirements.slice(0, 3).map((req, idx) => (
                        <li key={idx} className="text-xs text-gray-600 pl-3 border-l-2 border-gray-300">
                          {req}
                        </li>
                      ))}
                      {option.regulatoryRequirements.length > 3 && (
                        <li className="text-xs text-gray-500 pl-3">
                          +{option.regulatoryRequirements.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Select Button */}
              <div className="p-4 border-t border-gray-200">
                <Button
                  onClick={() => onSelect(option.category)}
                  className={`w-full ${
                    recommendation && recommendation.suggested_category === option.category
                      ? 'bg-green-600 hover:bg-green-700'
                      : option.isAIDetected
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  Select {CATEGORY_DISPLAY_NAMES[option.category]}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation Box (if exists) */}
      {recommendation && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-6">
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

      {/* Label Conflicts (if any) */}
      {labelConflicts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mt-4">
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
    </div>
  );
}
