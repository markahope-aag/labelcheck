# Regulatory Category Implementation Plan

**Purpose:** Technical roadmap for implementing category-specific regulatory analysis in LabelCheck

**Created:** 2025-10-22
**Priority:** High
**Estimated Effort:** 2-3 development sessions

---

## Overview

Based on the analysis in `REGULATORY_CATEGORY_ANALYSIS.md`, LabelCheck needs to:
1. Detect product category automatically
2. Apply category-specific regulatory rules
3. Provide category-appropriate recommendations
4. Check category-specific requirements

---

## Phase 1: Product Type Detection

### 1.1 Add Product Type Classification to AI Analysis

**File:** `app/api/analyze/route.ts`

**Implementation:**

```typescript
// Add to analysis prompt (BEFORE detailed analysis)
const productTypePrompt = `
FIRST: Determine the product category based on these criteria:

1. DIETARY SUPPLEMENT if:
   - Label states "dietary supplement" or "supplement facts"
   - Contains vitamins, minerals, herbs, botanicals, amino acids
   - Intended to supplement the diet
   - NOT a conventional food

2. ALCOHOLIC BEVERAGE if:
   - Contains ≥0.5% alcohol by volume (ABV)
   - Beer, wine, distilled spirits, malt beverages
   - Has TTB label approval number

3. NON_ALCOHOLIC BEVERAGE if:
   - Ready-to-drink liquid product
   - <0.5% alcohol or no alcohol
   - Bottled water, juice, soft drink, energy drink, sports drink
   - NOT a dietary supplement

4. CONVENTIONAL_FOOD if:
   - None of the above apply
   - Solid or semi-solid food product
   - Standard FDA food regulations apply

Return product_category as one of: "dietary_supplement", "alcoholic_beverage", "non_alcoholic_beverage", "conventional_food"
`;
```

**Updated JSON Response Schema:**

```typescript
interface AnalysisResult {
  product_category: 'dietary_supplement' | 'alcoholic_beverage' | 'non_alcoholic_beverage' | 'conventional_food';
  product_category_confidence: 'high' | 'medium' | 'low';
  product_category_reasoning: string;
  // ... existing fields
}
```

### 1.2 Database Schema Update

**Migration:** `supabase/migrations/20251023000000_add_product_category.sql`

```sql
-- Add product_category column to analyses table
ALTER TABLE analyses
ADD COLUMN product_category TEXT;

-- Add check constraint
ALTER TABLE analyses
ADD CONSTRAINT valid_product_category
CHECK (product_category IN (
  'dietary_supplement',
  'alcoholic_beverage',
  'non_alcoholic_beverage',
  'conventional_food'
));

-- Add index for filtering
CREATE INDEX idx_analyses_product_category
ON analyses(product_category);

-- Backfill existing records as conventional_food
UPDATE analyses
SET product_category = 'conventional_food'
WHERE product_category IS NULL;
```

---

## Phase 2: Category-Specific Rule Engine

### 2.1 Create Regulatory Rules Configuration

**File:** `lib/regulatory-rules.ts`

```typescript
export enum ProductCategory {
  CONVENTIONAL_FOOD = 'conventional_food',
  DIETARY_SUPPLEMENT = 'dietary_supplement',
  ALCOHOLIC_BEVERAGE = 'alcoholic_beverage',
  NON_ALCOHOLIC_BEVERAGE = 'non_alcoholic_beverage'
}

export interface RegulatoryRequirements {
  // Labeling requirements
  requiresNutritionFacts: boolean;
  nutritionFactsFormat: 'standard' | 'supplement' | 'optional';
  requiresIngredientList: boolean;
  ingredientListOptional: boolean;
  requiresAllergenStatement: boolean;

  // Claims & statements
  allowsHealthClaims: boolean;
  allowsNutrientContentClaims: boolean;
  allowsStructureFunctionClaims: boolean;
  requiresSupplementDisclaimer: boolean;

  // Special requirements
  requiresAlcoholWarning: boolean;
  requiresAlcoholContent: boolean;
  requiresSupplementFactsPanel: boolean;

  // Regulatory authority
  primaryAuthority: 'FDA' | 'TTB' | 'FDA_TTB';

  // Specific regulations
  applicableRegulations: string[];
  specificRequirements: string[];
}

export const REGULATORY_RULES: Record<ProductCategory, RegulatoryRequirements> = {
  [ProductCategory.CONVENTIONAL_FOOD]: {
    requiresNutritionFacts: true,
    nutritionFactsFormat: 'standard',
    requiresIngredientList: true,
    ingredientListOptional: false,
    requiresAllergenStatement: true,
    allowsHealthClaims: true, // Only FDA-authorized
    allowsNutrientContentClaims: true,
    allowsStructureFunctionClaims: false,
    requiresSupplementDisclaimer: false,
    requiresAlcoholWarning: false,
    requiresAlcoholContent: false,
    requiresSupplementFactsPanel: false,
    primaryAuthority: 'FDA',
    applicableRegulations: [
      '21 CFR Part 101',
      '21 CFR Part 102',
      '21 CFR Part 170'
    ],
    specificRequirements: [
      'Statement of identity',
      'Net quantity',
      'Nutrition facts panel',
      'Ingredient list (descending order by weight)',
      'Allergen statement (FALCPA)',
      'Manufacturer address',
      'GRAS ingredients only'
    ]
  },

  [ProductCategory.DIETARY_SUPPLEMENT]: {
    requiresNutritionFacts: false, // Uses Supplement Facts instead
    nutritionFactsFormat: 'supplement',
    requiresIngredientList: true,
    ingredientListOptional: false,
    requiresAllergenStatement: true,
    allowsHealthClaims: false, // Rare exceptions
    allowsNutrientContentClaims: true,
    allowsStructureFunctionClaims: true, // Key difference!
    requiresSupplementDisclaimer: true,
    requiresAlcoholWarning: false,
    requiresAlcoholContent: false,
    requiresSupplementFactsPanel: true,
    primaryAuthority: 'FDA',
    applicableRegulations: [
      '21 CFR 101.36',
      '21 USC 343(r)',
      'DSHEA 1994'
    ],
    specificRequirements: [
      'Statement of identity (must include "dietary supplement")',
      'Net quantity',
      'Supplement Facts panel',
      'Ingredient list (dietary ingredients + other ingredients)',
      'Allergen statement',
      'Manufacturer address',
      'Structure/function claim disclaimer if applicable',
      'New dietary ingredient notification if post-1994'
    ]
  },

  [ProductCategory.ALCOHOLIC_BEVERAGE]: {
    requiresNutritionFacts: false, // Voluntary
    nutritionFactsFormat: 'optional',
    requiresIngredientList: false, // Voluntary for most
    ingredientListOptional: true,
    requiresAllergenStatement: true, // Even if no ingredient list
    allowsHealthClaims: false, // Strictly prohibited
    allowsNutrientContentClaims: false, // Restricted, needs TTB approval
    allowsStructureFunctionClaims: false,
    requiresSupplementDisclaimer: false,
    requiresAlcoholWarning: true, // Government warning
    requiresAlcoholContent: true, // % ABV required
    requiresSupplementFactsPanel: false,
    primaryAuthority: 'TTB',
    applicableRegulations: [
      '27 CFR Part 4 (wine)',
      '27 CFR Part 5 (spirits)',
      '27 CFR Part 7 (beer)',
      '27 CFR Part 16 (warning)'
    ],
    specificRequirements: [
      'Brand name and class designation',
      'Alcohol content (% by volume)',
      'Net quantity',
      'Government WARNING statement',
      'Sulfite declaration if ≥10 ppm',
      'Major allergens (if present)',
      'Country of origin',
      'TTB approval/certificate number',
      'Health claims prohibited'
    ]
  },

  [ProductCategory.NON_ALCOHOLIC_BEVERAGE]: {
    requiresNutritionFacts: true,
    nutritionFactsFormat: 'standard',
    requiresIngredientList: true,
    ingredientListOptional: false,
    requiresAllergenStatement: true,
    allowsHealthClaims: true, // Only FDA-authorized
    allowsNutrientContentClaims: true,
    allowsStructureFunctionClaims: false,
    requiresSupplementDisclaimer: false,
    requiresAlcoholWarning: false,
    requiresAlcoholContent: false,
    requiresSupplementFactsPanel: false,
    primaryAuthority: 'FDA',
    applicableRegulations: [
      '21 CFR Part 101',
      '21 CFR Part 102',
      '21 CFR Part 165'
    ],
    specificRequirements: [
      'Statement of identity',
      'Net quantity (fluid ounces)',
      'Nutrition facts panel',
      'Ingredient list',
      'Allergen statement',
      'Manufacturer address',
      'Juice percentage if name implies juice (21 CFR 102.33)',
      'Bottled water specific requirements if applicable (21 CFR 165.110)',
      'Caffeine disclosure if significant amount'
    ]
  }
};

// Helper function to get rules for a category
export function getRegulatoryRules(category: ProductCategory): RegulatoryRequirements {
  return REGULATORY_RULES[category];
}

// Helper to check if a claim type is allowed
export function isClaimAllowed(
  category: ProductCategory,
  claimType: 'health' | 'nutrient_content' | 'structure_function'
): boolean {
  const rules = getRegulatoryRules(category);

  switch (claimType) {
    case 'health':
      return rules.allowsHealthClaims;
    case 'nutrient_content':
      return rules.allowsNutrientContentClaims;
    case 'structure_function':
      return rules.allowsStructureFunctionClaims;
    default:
      return false;
  }
}
```

### 2.2 Update Analysis Prompt with Category-Specific Rules

**File:** `app/api/analyze/route.ts`

```typescript
// After product category is determined
const category = analysisResult.product_category;
const rules = getRegulatoryRules(category as ProductCategory);

// Build category-specific prompt
const categorySpecificPrompt = `
PRODUCT CATEGORY: ${category.toUpperCase()}
REGULATORY AUTHORITY: ${rules.primaryAuthority}

APPLICABLE REGULATIONS:
${rules.applicableRegulations.map(reg => `- ${reg}`).join('\n')}

REQUIRED ELEMENTS FOR THIS CATEGORY:
${rules.specificRequirements.map(req => `- ${req}`).join('\n')}

CLAIM RULES FOR THIS CATEGORY:
- Health claims: ${rules.allowsHealthClaims ? 'ALLOWED (FDA-authorized only)' : 'PROHIBITED'}
- Nutrient content claims: ${rules.allowsNutrientContentClaims ? 'ALLOWED' : 'PROHIBITED'}
- Structure/function claims: ${rules.allowsStructureFunctionClaims ? 'ALLOWED (requires disclaimer)' : 'PROHIBITED'}

${rules.requiresSupplementDisclaimer ? `
REQUIRED DISCLAIMER:
"These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease."
` : ''}

${rules.requiresAlcoholWarning ? `
REQUIRED WARNING:
"GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."
` : ''}

ANALYSIS INSTRUCTIONS:
Apply ONLY the regulations and requirements listed above for ${category}.
Do NOT apply rules from other product categories.
`;
```

---

## Phase 3: Enhanced Validation Logic

### 3.1 Category-Specific Validation Functions

**File:** `lib/category-validators.ts`

```typescript
import { ProductCategory, getRegulatoryRules } from './regulatory-rules';

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
  categorySpecificIssues: string[];
}

// Validate dietary supplement requirements
export function validateDietarySupplement(analysis: any): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check for "dietary supplement" in identity
  if (!analysis.product_name?.toLowerCase().includes('dietary supplement') &&
      !analysis.product_name?.toLowerCase().includes('supplement')) {
    violations.push('Statement of identity must include "dietary supplement"');
  }

  // Check for Supplement Facts panel
  if (analysis.nutrition_labeling?.format !== 'supplement') {
    violations.push('Must use Supplement Facts panel, not Nutrition Facts');
  }

  // Check for structure/function claim disclaimer if claims present
  const hasStructureFunctionClaim = analysis.claims_and_statements?.claims?.some(
    (claim: any) => claim.type === 'structure_function'
  );

  if (hasStructureFunctionClaim && !analysis.required_disclaimers?.includes('FDA evaluation')) {
    violations.push('Structure/function claims require FDA disclaimer statement');
  }

  // Check ingredient format
  if (!analysis.ingredient_labeling?.separate_dietary_ingredients) {
    warnings.push('Dietary ingredients should be listed separately from other ingredients');
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    categorySpecificIssues: []
  };
}

// Validate alcoholic beverage requirements
export function validateAlcoholicBeverage(analysis: any): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check for alcohol content
  if (!analysis.alcohol_content) {
    violations.push('Alcohol content (% ABV) must be declared');
  }

  // Check for government warning
  if (!analysis.government_warning || !analysis.government_warning.includes('GOVERNMENT WARNING')) {
    violations.push('Mandatory government warning statement missing (27 CFR Part 16)');
  }

  // Check for prohibited health claims
  const hasHealthClaim = analysis.claims_and_statements?.claims?.some(
    (claim: any) => claim.type === 'health' || claim.implies_health_benefit
  );

  if (hasHealthClaim) {
    violations.push('Health claims are PROHIBITED on alcoholic beverages (27 CFR 4.64, 5.42, 7.54)');
  }

  // Nutrition facts should be optional
  if (analysis.nutrition_labeling?.present && !analysis.claims_and_statements?.has_nutrition_claim) {
    warnings.push('Nutrition facts are optional for alcoholic beverages unless nutrition claim is made');
  }

  // Ingredient list is optional
  if (!analysis.ingredient_labeling?.ingredients_list) {
    warnings.push('Ingredient list is optional for alcoholic beverages (but allergens must still be declared)');
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    categorySpecificIssues: []
  };
}

// Validate non-alcoholic beverage requirements
export function validateNonAlcoholicBeverage(analysis: any): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check juice percentage declaration if name implies juice
  if (analysis.product_name?.toLowerCase().includes('juice') ||
      analysis.product_name?.toLowerCase().includes('fruit')) {
    if (!analysis.juice_percentage_declared) {
      violations.push('Products with names implying juice must declare % juice content (21 CFR 102.33)');
    }
  }

  // Check bottled water requirements
  if (analysis.product_name?.toLowerCase().includes('water')) {
    // Specific bottled water requirements (21 CFR 165.110)
    warnings.push('Bottled water has specific requirements under 21 CFR 165.110');
  }

  // Check caffeine disclosure for energy drinks
  if (analysis.product_type?.toLowerCase().includes('energy')) {
    if (!analysis.caffeine_content_declared) {
      warnings.push('Energy drinks should disclose caffeine content');
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    categorySpecificIssues: []
  };
}

// Main validation orchestrator
export function validateByCategory(
  category: ProductCategory,
  analysis: any
): ValidationResult {
  switch (category) {
    case ProductCategory.DIETARY_SUPPLEMENT:
      return validateDietarySupplement(analysis);
    case ProductCategory.ALCOHOLIC_BEVERAGE:
      return validateAlcoholicBeverage(analysis);
    case ProductCategory.NON_ALCOHOLIC_BEVERAGE:
      return validateNonAlcoholicBeverage(analysis);
    case ProductCategory.CONVENTIONAL_FOOD:
      // Conventional food uses standard validation
      return { isValid: true, violations: [], warnings: [], categorySpecificIssues: [] };
    default:
      return { isValid: false, violations: ['Unknown product category'], warnings: [], categorySpecificIssues: [] };
  }
}
```

### 3.2 Integrate Validation into Analysis Route

**File:** `app/api/analyze/route.ts`

```typescript
import { validateByCategory, ProductCategory } from '@/lib/category-validators';

// After AI analysis completes
const category = analysisData.product_category as ProductCategory;
const categoryValidation = validateByCategory(category, analysisData);

// Add category-specific violations to recommendations
if (categoryValidation.violations.length > 0) {
  analysisData.recommendations = analysisData.recommendations || [];
  categoryValidation.violations.forEach(violation => {
    analysisData.recommendations.push({
      priority: 'critical',
      recommendation: violation,
      regulation: getRegulatoryRules(category).applicableRegulations[0],
      category: 'category_specific'
    });
  });
}

// Add warnings
if (categoryValidation.warnings.length > 0) {
  analysisData.recommendations = analysisData.recommendations || [];
  categoryValidation.warnings.forEach(warning => {
    analysisData.recommendations.push({
      priority: 'warning',
      recommendation: warning,
      regulation: getRegulatoryRules(category).applicableRegulations[0],
      category: 'category_specific'
    });
  });
}
```

---

## Phase 4: UI Updates

### 4.1 Display Product Category

**File:** `app/analyze/page.tsx`

Add category badge to results display:

```tsx
{result.product_category && (
  <div className="mb-4">
    <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
      {formatProductCategory(result.product_category)}
    </span>
    <span className="ml-2 text-xs text-slate-600">
      Regulated by: {getRegulatoryRules(result.product_category).primaryAuthority}
    </span>
  </div>
)}
```

### 4.2 Category-Specific Help Text

Add contextual help explaining category-specific requirements:

```tsx
{result.product_category === 'dietary_supplement' && (
  <Alert className="mt-4">
    <Info className="h-4 w-4" />
    <AlertDescription>
      <strong>Dietary Supplement Regulations:</strong> Products must use
      "Supplement Facts" panel and may make structure/function claims with
      required disclaimer. Health claims are generally not permitted.
    </AlertDescription>
  </Alert>
)}

{result.product_category === 'alcoholic_beverage' && (
  <Alert className="mt-4" variant="warning">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      <strong>Alcoholic Beverage Regulations:</strong> Regulated by TTB.
      Must include government warning statement. Health claims prohibited.
      Nutrition facts voluntary unless making nutrition claims.
    </AlertDescription>
  </Alert>
)}
```

### 4.3 History Page Filtering

**File:** `app/history/page.tsx`

Add category filter:

```tsx
const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');

// In filter controls
<Select value={categoryFilter} onValueChange={setCategoryFilter}>
  <SelectTrigger>
    <SelectValue placeholder="All Categories" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Categories</SelectItem>
    <SelectItem value="conventional_food">Conventional Food</SelectItem>
    <SelectItem value="dietary_supplement">Dietary Supplements</SelectItem>
    <SelectItem value="alcoholic_beverage">Alcoholic Beverages</SelectItem>
    <SelectItem value="non_alcoholic_beverage">Non-Alcoholic Beverages</SelectItem>
  </SelectContent>
</Select>
```

---

## Phase 5: Testing & Validation

### 5.1 Create Test Cases

**File:** `test-cases/category-classification/`

```
test-cases/
├── conventional-food/
│   ├── cereal-box.jpg
│   ├── frozen-pizza.jpg
│   ├── canned-soup.jpg
├── dietary-supplements/
│   ├── vitamin-c-bottle.jpg
│   ├── protein-powder.jpg
│   ├── multivitamin.jpg
├── alcoholic-beverages/
│   ├── craft-beer.jpg
│   ├── red-wine.jpg
│   ├── vodka.jpg
├── non-alcoholic-beverages/
│   ├── energy-drink.jpg
│   ├── orange-juice.jpg
│   ├── bottled-water.jpg
└── edge-cases/
    ├── liquid-vitamin-supplement.jpg  # Could be supplement or beverage
    ├── kombucha-03percent.jpg          # <0.5% = non-alcoholic
    ├── near-beer.jpg                   # <0.5% = non-alcoholic
```

### 5.2 Automated Test Script

**File:** `test-category-classification.js`

```javascript
const testCases = [
  {
    name: "Vitamin C Supplement",
    image: "./test-cases/dietary-supplements/vitamin-c-bottle.jpg",
    expectedCategory: "dietary_supplement",
    expectedRequirements: [
      "Supplement Facts panel required",
      "Structure/function claims allowed with disclaimer",
      "Must include 'dietary supplement' in statement of identity"
    ]
  },
  {
    name: "Craft Beer",
    image: "./test-cases/alcoholic-beverages/craft-beer.jpg",
    expectedCategory: "alcoholic_beverage",
    expectedRequirements: [
      "Government warning required",
      "Alcohol content (ABV) required",
      "Health claims prohibited",
      "Nutrition facts optional"
    ]
  },
  // ... more test cases
];

// Run tests
for (const testCase of testCases) {
  const result = await analyzeLabel(testCase.image);
  console.log(`\nTesting: ${testCase.name}`);
  console.log(`Expected: ${testCase.expectedCategory}`);
  console.log(`Actual: ${result.product_category}`);
  console.log(`Match: ${result.product_category === testCase.expectedCategory ? '✅' : '❌'}`);
}
```

---

## Implementation Timeline

### Week 1: Foundation
- [x] Complete regulatory analysis (DONE)
- [ ] Phase 1: Product type detection (8 hours)
  - Update AI prompt
  - Update JSON schema
  - Database migration
  - Test classification accuracy

### Week 2: Rules Engine
- [ ] Phase 2: Category-specific rules (12 hours)
  - Create regulatory rules config
  - Implement category-specific prompts
  - Test with each category

### Week 3: Validation & UI
- [ ] Phase 3: Enhanced validation (8 hours)
  - Category validators
  - Integration into analysis
- [ ] Phase 4: UI updates (6 hours)
  - Category badges
  - Help text
  - History filtering

### Week 4: Testing & Refinement
- [ ] Phase 5: Testing (10 hours)
  - Create test cases
  - Automated testing
  - Manual validation
  - Bug fixes

**Total Estimated Effort:** ~44 hours (approximately 2-3 full development sessions)

---

## Success Criteria

1. **Classification Accuracy:** >95% correct product category detection
2. **No False Positives:** Zero violations from wrong category rules
3. **Category Coverage:** All four categories fully supported
4. **Regulatory Accuracy:** 100% compliance with category-specific requirements
5. **User Experience:** Clear category indication and appropriate guidance

---

## Risks & Mitigation

### Risk 1: Edge Case Classification
**Issue:** Products that straddle categories (e.g., liquid supplements vs. beverages)
**Mitigation:**
- Provide confidence score
- Allow manual override
- Document decision criteria clearly

### Risk 2: TTB Rules Complexity
**Issue:** Alcoholic beverage regulations are complex and vary by type
**Mitigation:**
- Start with common requirements
- Phase in beer/wine/spirits-specific rules
- Link to TTB resources

### Risk 3: Backward Compatibility
**Issue:** Existing analyses don't have category
**Mitigation:**
- Default to conventional_food for NULL category
- Provide migration script
- Don't break existing functionality

---

## Next Steps

1. Review and approve this plan
2. Prioritize phases based on business needs
3. Begin implementation with Phase 1
4. Create test dataset for validation
5. Iterate based on testing results

---

## References

- `REGULATORY_CATEGORY_ANALYSIS.md` - Detailed regulatory comparison
- `CLAUDE.md` - Project context and current implementation
- `lib/regulatory-documents.ts` - Current regulatory document handling
- `app/api/analyze/route.ts` - Main analysis endpoint

