import { ProductCategory } from './supabase';

/**
 * Category-Specific Analysis Prompts
 *
 * This module provides focused, category-specific prompts for regulatory analysis.
 * Instead of sending a 30KB+ prompt with rules for ALL categories, we build
 * focused prompts containing only the relevant regulatory requirements.
 *
 * Performance benefit: 5-10 second savings per analysis
 * Accuracy benefit: AI focuses on relevant rules without distraction
 */

/**
 * Lightweight category classification prompt
 * Used in Pass 1 to determine which category-specific prompt to use in Pass 2
 */
export function getCategoryClassificationPrompt(isPdf: boolean): string {
  return `You are a regulatory expert. Your ONLY task is to classify this ${isPdf ? 'document' : 'label image'} into ONE product category.

**CLASSIFICATION RULES** (in priority order):

1. **🔍 CHECK PANEL TYPE FIRST** (this is the definitive indicator):
   - "Supplement Facts" panel → **DIETARY_SUPPLEMENT**
   - "Nutrition Facts" panel → **NOT a supplement** (go to step 2)

2. **Check for Alcohol**:
   - ≥0.5% ABV OR shows "% ALC BY VOL" → **ALCOHOLIC_BEVERAGE**
   - TTB approval number → **ALCOHOLIC_BEVERAGE**

3. **Check Product Type** (for Nutrition Facts products):
   - Ready-to-drink beverage (soda, juice, tea, energy drink) → **NON_ALCOHOLIC_BEVERAGE**
   - All other foods → **CONVENTIONAL_FOOD**

**EDGE CASES:**
- Dairy liquids (milk, drinkable yogurt) → CONVENTIONAL_FOOD (not beverages)
- Coffee/tea (ready-to-drink, bottled) → NON_ALCOHOLIC_BEVERAGE
- Coffee/tea (grounds, bags) → CONVENTIONAL_FOOD
- Soups, broths → CONVENTIONAL_FOOD (not beverages)

Return ONLY this JSON (no other text):
{
  "product_category": "CONVENTIONAL_FOOD" | "DIETARY_SUPPLEMENT" | "ALCOHOLIC_BEVERAGE" | "NON_ALCOHOLIC_BEVERAGE",
  "category_rationale": "Brief explanation with key evidence (e.g., 'Has Supplement Facts panel')",
  "confidence": "high" | "medium" | "low",
  "is_ambiguous": true | false,
  "alternative_categories": ["CATEGORY_1", "CATEGORY_2"] // if ambiguous
}`;
}

/**
 * Build category-specific analysis prompt based on detected category
 * This is the main performance optimization - only includes relevant rules
 */
export function getCategorySpecificAnalysisPrompt(
  category: ProductCategory,
  isPdf: boolean
): string {
  const commonIntro = `You are a labeling regulatory compliance expert. Analyze this ${category} label ${isPdf ? 'PDF document' : 'image'} and provide a comprehensive evaluation of its compliance with FDA${category === 'ALCOHOLIC_BEVERAGE' ? '/TTB' : ''} labeling requirements.

**IMPORTANT:** You already know this is a **${category}**. Focus your analysis on ${getCategoryDescription(category)}-specific requirements.`;

  const commonSections = getCommonAnalysisSections();
  const categoryRules = getCategorySpecificRules(category);
  const jsonSchema = getJSONSchema();

  return `${commonIntro}

${categoryRules}

${commonSections}

${jsonSchema}`;
}

/**
 * Get human-readable category description
 */
function getCategoryDescription(category: ProductCategory): string {
  const descriptions: Record<ProductCategory, string> = {
    DIETARY_SUPPLEMENT: 'dietary supplement',
    CONVENTIONAL_FOOD: 'conventional food',
    ALCOHOLIC_BEVERAGE: 'alcoholic beverage',
    NON_ALCOHOLIC_BEVERAGE: 'non-alcoholic beverage',
  };
  return descriptions[category];
}

/**
 * Category-specific regulatory rules
 * Only the relevant rules for the detected category
 */
function getCategorySpecificRules(category: ProductCategory): string {
  switch (category) {
    case 'DIETARY_SUPPLEMENT':
      return getDietarySupplementRules();
    case 'CONVENTIONAL_FOOD':
      return getConventionalFoodRules();
    case 'ALCOHOLIC_BEVERAGE':
      return getAlcoholicBeverageRules();
    case 'NON_ALCOHOLIC_BEVERAGE':
      return getNonAlcoholicBeverageRules();
  }
}

/**
 * Dietary Supplement specific rules (21 CFR 101.36, DSHEA)
 */
function getDietarySupplementRules(): string {
  return `**DIETARY SUPPLEMENT REQUIREMENTS** (21 CFR 101.36, DSHEA):

**1. REQUIRED PANEL TYPE:**
   - MUST have "Supplement Facts" panel (NOT "Nutrition Facts")
   - Panel type mismatch = CRITICAL violation

**2. STATEMENT OF IDENTITY:**
   - Must include term "dietary supplement" unless obvious from context
   - Example: "Vitamin C Dietary Supplement" or "Multivitamin"

**3. INGREDIENT COMPLIANCE:**
   - Check all ingredients against NDI (New Dietary Ingredient) database
   - Pre-1994 ingredients (Old Dietary Ingredients) are GRAS for supplements
   - Post-1994 ingredients may require NDI notification

**4. STRUCTURE/FUNCTION CLAIMS:**
   - Allowed: "Supports immune health", "Promotes bone strength"
   - Prohibited: Disease claims, cure claims
   - IF structure/function claims present → MUST have FDA disclaimer
   - Required disclaimer: "This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease."

**5. SEXUAL HEALTH CLAIMS (Special Scrutiny):**
   - Acceptable: "Supports healthy sexual function", "Promotes sexual vitality"
   - Gray zone: "Improves performance and pleasure" (only if wellness context, NOT medical)
   - Prohibited: "Treats ED", "Cures impotence", "Works like Viagra"

**6. DOSAGE & DIRECTIONS:**
   - Must include suggested use/directions
   - Serving size required

**7. ALLERGEN LABELING:**
   - Same requirements as conventional food (FALCPA + FASTER Act)
   - Declare major allergens in plain language`;
}

/**
 * Conventional Food specific rules (21 CFR 101.9, FALCPA, FASTER Act)
 */
function getConventionalFoodRules(): string {
  return `**CONVENTIONAL FOOD REQUIREMENTS** (21 CFR 101.9):

**1. REQUIRED PANEL TYPE:**
   - MUST have "Nutrition Facts" panel (NOT "Supplement Facts")
   - Panel type mismatch = CRITICAL violation

**2. NUTRITION FACTS PANEL ROUNDING:**
   - Calories: <5 → "0" or "5" (NOT "1", "2", "3", "4")
   - Fat, saturated fat, trans fat, cholesterol: <0.5g → "0g"
   - Dietary fiber: <0.5g → "0g" (NOT "0.1g", "0.2g")
   - Sodium: <5mg → "0mg"
   - Vitamins/minerals: <2% DV → "0%" (unless fortified)

**3. FORTIFICATION POLICY (21 CFR 104):**
   - Check if product is appropriate fortification vehicle
   - Prohibited vehicles: coffee, tea, candy, soda, carbonated beverages
   - IF inappropriate vehicle + fortified → NON-COMPLIANT

**4. NUTRIENT CONTENT CLAIMS:**
   - "High in X": ≥20% DV per serving
   - "Good source of X": 10-19% DV per serving
   - "Low fat": ≤3g per serving
   - "Fat free": <0.5g per serving
   - Validate ALL nutrient content claims against actual values

**5. HEALTH CLAIMS:**
   - Only FDA-authorized health claims allowed
   - Must use exact FDA wording
   - Examples: "Calcium and osteoporosis", "Sodium and hypertension"

**6. ALLERGEN LABELING (FALCPA + FASTER Act):**
   - Must declare: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame
   - "Contains:" statement OR plain language in ingredient list
   - Advisory statements ("may contain") are voluntary

**7. STATEMENT OF IDENTITY:**
   - No disease claims, drug claims, or health claims
   - Avoid terms like: "cure", "treat", "prevent", "therapy"
   - Marketing terms like "superfood", "immunity boost" may be problematic`;
}

/**
 * Alcoholic Beverage specific rules (TTB regulations, 27 CFR)
 */
function getAlcoholicBeverageRules(): string {
  return `**ALCOHOLIC BEVERAGE REQUIREMENTS** (TTB, 27 CFR):

**1. TTB JURISDICTION:**
   - Products ≥0.5% ABV regulated by TTB, not FDA
   - Requires COLA (Certificate of Label Approval)

**2. REQUIRED ELEMENTS:**
   - Brand name
   - Class/type designation (e.g., "Beer", "Wine", "Vodka")
   - Alcohol content (% ABV or proof)
   - Net contents (fl oz or mL)
   - Health warning statement (pregnancy/driving)
   - Name and address of bottler/importer

**3. HEALTH WARNING (27 CFR 16.21):**
   - Required: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."

**4. PROHIBITED CLAIMS:**
   - No health claims allowed
   - No disease prevention claims
   - No curative or therapeutic claims
   - Cannot claim product is healthy or nutritious

**5. MISLEADING STATEMENTS:**
   - Cannot be false or misleading
   - Cannot imply government endorsement

**6. ALLERGEN LABELING:**
   - Major allergens must be declared (if present)
   - Sulfites ≥10ppm must be declared`;
}

/**
 * Non-Alcoholic Beverage specific rules
 */
function getNonAlcoholicBeverageRules(): string {
  return `**NON-ALCOHOLIC BEVERAGE REQUIREMENTS** (21 CFR 101.9):

**1. REQUIRED PANEL TYPE:**
   - MUST have "Nutrition Facts" panel
   - <0.5% ABV (otherwise it's an alcoholic beverage)

**2. NUTRITION FACTS PANEL:**
   - Same rounding rules as conventional food
   - Serving size typically in fl oz
   - Must include calories, total sugar, added sugars

**3. INGREDIENT LIST:**
   - Descending order by weight
   - All ingredients must be listed
   - Water must be listed (typically first ingredient)

**4. CAFFEINE DISCLOSURE:**
   - If added caffeine → Must state "Contains Caffeine" or show amount
   - Energy drinks: Should disclose caffeine content

**5. JUICE PERCENTAGE:**
   - If "juice" in name → Must declare percent juice
   - "100% Juice" must be 100% juice (no added sugars/water)

**6. ALLERGEN LABELING:**
   - Same as conventional food (FALCPA + FASTER Act)

**7. HEALTH & NUTRIENT CONTENT CLAIMS:**
   - Same rules as conventional food
   - Validate any "low calorie", "sugar free", etc. claims

**8. FORTIFICATION:**
   - Generally NOT appropriate for carbonated beverages
   - Check fortification policy compliance`;
}

/**
 * Common analysis sections (apply to all categories)
 */
function getCommonAnalysisSections(): string {
  return `
**ANALYSIS APPROACH:**

1. **Extract Information:**
   - Statement of identity
   - Net quantity
   - Ingredient list
   - Nutrition/Supplement Facts panel
   - All claims and statements
   - Manufacturer information

2. **Evaluate Compliance:**
   - Check required elements are present
   - Validate formats and wording
   - Check for prohibited statements
   - Verify allergen declarations

3. **Assign Status:**
   - **COMPLIANT**: Meets all requirements
   - **POTENTIALLY-NON-COMPLIANT**: Likely violation but depends on information not visible
   - **NON-COMPLIANT**: Clear violation of regulations

4. **Provide Recommendations:**
   - CRITICAL: Must fix (major violations)
   - HIGH: Important issues
   - MEDIUM: Minor improvements
   - LOW: Best practice suggestions`;
}

/**
 * JSON schema for analysis response
 */
function getJSONSchema(): string {
  return `
**OUTPUT FORMAT** (JSON only, no other text):

{
  "product_category": "CONVENTIONAL_FOOD|DIETARY_SUPPLEMENT|ALCOHOLIC_BEVERAGE|NON_ALCOHOLIC_BEVERAGE",
  "category_rationale": "Why this category was assigned",
  "statement_of_identity": {
    "text": "Product name",
    "status": "compliant|potentially_non_compliant|non_compliant",
    "issues": ["Issue 1", "Issue 2"],
    "recommendations": ["Recommendation 1"]
  },
  "net_quantity": {
    "value": "Amount and unit",
    "status": "compliant|potentially_non_compliant|non_compliant",
    "issues": []
  },
  "ingredient_list": {
    "ingredients": ["ingredient1", "ingredient2"],
    "status": "compliant|potentially_non_compliant|non_compliant",
    "issues": []
  },
  "nutrition_panel": {
    "panel_type_present": "Nutrition Facts|Supplement Facts|None",
    "panel_type_required": "Nutrition Facts|Supplement Facts",
    "panel_type_correct": true|false,
    "rounding_validation": {
      "status": "compliant|non_compliant|not_applicable",
      "errors": ["Error description"]
    },
    "status": "compliant|potentially_non_compliant|non_compliant"
  },
  "allergen_labeling": {
    "allergens_detected": ["milk", "eggs"],
    "allergen_statement_present": true|false,
    "status": "compliant|potentially_non_compliant|non_compliant"
  },
  "claims_analysis": {
    "claims": [
      {
        "claim_text": "The actual claim",
        "claim_type": "nutrient_content|health_claim|structure_function",
        "classification": "compliant|prohibited|needs_review",
        "rationale": "Why this classification"
      }
    ]
  },
  "disclaimer_requirements": {
    "disclaimer_required": true|false,
    "disclaimer_present": true|false,
    "disclaimer_text_found": "Exact text or null",
    "disclaimer_wording_correct": true|false,
    "status": "compliant|non_compliant|not_applicable"
  },
  "overall_assessment": {
    "primary_compliance_status": "compliant|potentially_non_compliant|non_compliant",
    "summary": "2-3 sentence summary"
  },
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "recommendation": "Specific actionable recommendation",
      "regulation": "Regulation citation"
    }
  ]
}`;
}
