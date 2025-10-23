# Regulatory Category Analysis: Food Products vs. Dietary Supplements vs. Beverages

**Purpose:** Comprehensive analysis of labeling regulation differences across product categories for LabelCheck implementation

**Created:** 2025-10-22
**Status:** Initial Analysis

---

## Executive Summary

The FDA and TTB regulate different product categories with distinct requirements that significantly impact label compliance. **LabelCheck currently treats all products generically, which can lead to incorrect compliance assessments.**

### Key Findings:

1. **Four distinct regulatory frameworks** apply based on product type
2. **Different agencies** have jurisdiction (FDA vs. TTB)
3. **Unique labeling requirements** for each category
4. **Health claim rules** vary dramatically
5. **Ingredient disclosure** requirements differ substantially

---

## Category Definitions

### 1. Conventional Food Products
**Regulatory Authority:** FDA - Center for Food Safety and Applied Nutrition (CFSAN)
**Primary Regulations:** 21 CFR Part 101, 21 CFR Part 102
**Definition:** Articles used for food or drink, excluding dietary supplements and beverages with specific regulations

### 2. Dietary Supplements
**Regulatory Authority:** FDA - CFSAN
**Primary Regulations:** Dietary Supplement Health and Education Act (DSHEA) 1994, 21 CFR Part 101.36
**Definition:** Products intended to supplement the diet containing vitamins, minerals, herbs, amino acids, or other dietary substances

### 3. Alcoholic Beverages
**Regulatory Authority:** TTB (Alcohol and Tobacco Tax and Trade Bureau) + FDA (nutrition labeling)
**Primary Regulations:** 27 CFR Parts 4, 5, 7, 16 (TTB), 21 CFR 101 (FDA for nutrition)
**Definition:** Beer, wine, distilled spirits containing ≥0.5% alcohol by volume

### 4. Non-Alcoholic Beverages
**Regulatory Authority:** FDA - CFSAN
**Primary Regulations:** 21 CFR Part 101, 21 CFR Part 102, 21 CFR 165 (standards of identity)
**Definition:** Ready-to-drink beverages <0.5% ABV including bottled water, soft drinks, juices, energy drinks

---

## Detailed Comparison Matrix

### A. REQUIRED LABEL ELEMENTS

| Element | Conventional Food | Dietary Supplements | Alcoholic Beverages | Non-Alcoholic Beverages |
|---------|------------------|---------------------|---------------------|------------------------|
| **Statement of Identity** | ✅ Required (21 CFR 101.3) | ✅ "Dietary Supplement" required (21 CFR 101.36) | ✅ Class designation required (27 CFR 4/5/7) | ✅ Required (21 CFR 101.3) |
| **Net Quantity** | ✅ Required (21 CFR 101.105) | ✅ Required (21 CFR 101.105) | ✅ Required (27 CFR 4.37) | ✅ Required (21 CFR 101.105) |
| **Nutrition Facts** | ✅ Required (21 CFR 101.9) | ✅ "Supplement Facts" (21 CFR 101.36) | ⚠️ Voluntary unless claim made | ✅ Required (21 CFR 101.9) |
| **Ingredient List** | ✅ Descending order by weight (21 CFR 101.4) | ✅ Separate ingredient panel (21 CFR 101.36) | ⚠️ Optional for some types (27 CFR 7.22) | ✅ Required (21 CFR 101.4) |
| **Allergen Statement** | ✅ FALCPA required (21 USC 343) | ✅ FALCPA required | ✅ Required if major allergen present | ✅ FALCPA required |
| **Manufacturer Address** | ✅ Required (21 CFR 101.5) | ✅ Required (21 CFR 101.5) | ✅ Required (27 CFR 4.38) | ✅ Required (21 CFR 101.5) |
| **Alcohol Content** | ❌ N/A | ❌ N/A | ✅ Required (27 CFR 4.36) | ❌ N/A |
| **Government Warning** | ❌ Generally no | ❌ No (unless specific ingredient) | ✅ Mandatory (27 CFR 16) | ❌ No |
| **Country of Origin** | ⚠️ If imported | ⚠️ If imported | ✅ Required (27 CFR 4.39) | ⚠️ If imported |

### B. NUTRITION LABELING SPECIFICS

#### Conventional Food (21 CFR 101.9)
- **Format:** Nutrition Facts panel
- **Serving Size:** Based on RACC (Reference Amounts Customarily Consumed)
- **Required Nutrients:**
  - Calories, Total Fat, Saturated Fat, Trans Fat
  - Cholesterol, Sodium
  - Total Carbohydrate, Dietary Fiber, Total Sugars, Added Sugars
  - Protein
  - Vitamin D, Calcium, Iron, Potassium
- **Exemptions:** Small businesses (<$10M revenue), certain small packages

#### Dietary Supplements (21 CFR 101.36)
- **Format:** Supplement Facts panel (distinct design)
- **Serving Size:** Manufacturer determines
- **Required Information:**
  - Serving size and servings per container
  - Amount per serving of dietary ingredients
  - % Daily Value (if established)
  - Source ingredients (e.g., "vitamin C as ascorbic acid")
- **Unique Requirements:**
  - Separate listing of dietary vs. non-dietary ingredients
  - "Other ingredients" section below panel
  - Proprietary blend disclosure with total weight

#### Alcoholic Beverages (27 CFR 4/5/7)
- **Format:** Optional until nutrition claim is made
- **When Required:** If any nutrition claim appears, full Nutrition Facts required
- **Unique Aspects:**
  - Alcohol content as % by volume (ABV)
  - Calorie disclosure from alcohol
  - TTB formula approval may be required
  - Beer/wine/spirits have different specific rules

#### Non-Alcoholic Beverages (21 CFR 101.9)
- **Format:** Nutrition Facts panel (same as conventional food)
- **Serving Size:** Fluid ounces based on RACC
- **Special Considerations:**
  - Bottled water has specific requirements (21 CFR 165.110)
  - Juice products must declare % juice (21 CFR 102.33)
  - "Diet" or "zero calorie" claims trigger specific requirements
  - Energy drinks may have additional caffeine disclosure requirements

### C. HEALTH CLAIMS & STATEMENTS

#### Conventional Food
**Authorized Claims:**
- ✅ Nutrient content claims (21 CFR 101.13) - e.g., "low fat," "high fiber"
- ✅ Health claims (21 CFR 101.14) - Must be FDA-authorized (e.g., "calcium reduces osteoporosis risk")
- ✅ Qualified health claims - Based on emerging science with disclaimer
- ❌ Structure/function claims - NOT allowed
- ❌ Disease claims - Prohibited

**Restrictions:**
- Must meet specific nutrient thresholds
- Cannot make drug claims
- "Natural" claims must be truthful and not misleading
- Implied health benefits scrutinized

#### Dietary Supplements
**Authorized Claims:**
- ✅ Structure/function claims (21 USC 343(r)(6)) - e.g., "supports immune health"
- ✅ Nutrient content claims (if applicable)
- ⚠️ Health claims (rare, must meet food standard)
- ⚠️ Qualified health claims (with significant scientific agreement)
- ❌ Disease claims - Prohibited (except authorized health claims)

**Unique Requirements:**
- **Required Disclaimer:** "These statements have not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease."
- Must notify FDA within 30 days of marketing structure/function claim
- Cannot claim to diagnose, treat, cure, or prevent disease
- "Superfood," "immunity boost," "detox" under scrutiny but not automatically banned

#### Alcoholic Beverages
**Authorized Claims:**
- ⚠️ Health claims - Generally prohibited (27 CFR 4.64, 5.42, 7.54)
- ❌ Therapeutic claims - Strictly prohibited
- ⚠️ Nutrient content claims - Restricted, require TTB approval
- ✅ Organic claims - Allowed if certified

**Restrictions:**
- Cannot suggest health benefits from alcohol consumption
- Cannot target health-conscious consumers with misleading claims
- "Low carb" or "light" claims must meet TTB definitions
- Mandatory warning statement overrides any health messaging

#### Non-Alcoholic Beverages
**Authorized Claims:**
- ✅ Nutrient content claims (same as conventional food)
- ✅ Health claims (if FDA-authorized)
- ⚠️ Energy/performance claims - Scrutinized, must be substantiated
- ❌ Drug claims - Prohibited

**Special Considerations:**
- "Diet" requires <5 calories per serving
- "Zero sugar" requires <0.5g per serving
- Caffeine content disclosure increasingly expected
- "Natural" heavily scrutinized for beverages with additives
- Juice % must be declared if product name implies juice

### D. INGREDIENT LISTING REQUIREMENTS

#### Conventional Food (21 CFR 101.4)
- **Order:** Descending by weight
- **Format:** Common or usual name
- **Sub-ingredients:** Required for compound ingredients
- **Colors:** By specific or generic name (e.g., "FD&C Yellow 5" or "artificial color")
- **Spices:** May be listed as "spices" unless colorant
- **Incidental Additives:** May be exempt if no functional effect

#### Dietary Supplements (21 CFR 101.36)
- **Order:** Two sections - (1) Dietary ingredients (in Supplement Facts), (2) Other ingredients (below panel)
- **Format:**
  - Dietary ingredients: Name and source (e.g., "Vitamin C (as ascorbic acid)")
  - Other ingredients: Complete listing of non-dietary ingredients
- **Proprietary Blends:** Total weight required, individual amounts optional
- **Fillers/Binders:** Must be listed in "Other ingredients"

#### Alcoholic Beverages (27 CFR 7.22, 4.32, 5.32)
- **Beer (27 CFR 7.22):**
  - Voluntary ingredients list permitted
  - If included, must list all ingredients except water, malted barley, hops, yeast
  - Major allergens must be declared if voluntary list used
- **Wine (27 CFR 4.32):**
  - Voluntary ingredients list permitted
  - Sulfite declaration required if ≥10 ppm
  - Major allergens required
- **Distilled Spirits (27 CFR 5.32):**
  - No ingredient list required
  - Major allergens required
  - Sulfites required if ≥10 ppm

**Key Difference:** Alcoholic beverages generally NOT required to list ingredients (except allergens/sulfites), unlike FDA-regulated products.

#### Non-Alcoholic Beverages (21 CFR 101.4)
- **Order:** Descending by weight (same as conventional food)
- **Water:** Must be listed if added
- **Juice:** Juice ingredients often listed separately if significant percentage
- **Concentrates:** Source declared (e.g., "apple juice from concentrate")
- **Caffeine:** Natural vs. added must be distinguishable
- **Colors/Flavors:** Specific disclosure requirements for "natural flavor" vs. "artificial flavor"

### E. SPECIFIC INGREDIENT REGULATIONS

#### GRAS (Generally Recognized as Safe)
- **Conventional Food:** ✅ Must use GRAS ingredients (21 CFR 170)
- **Dietary Supplements:** ✅ Dietary ingredients have separate evaluation (21 USC 342(f))
- **Alcoholic Beverages:** ⚠️ TTB formula approval process, not GRAS-based
- **Non-Alcoholic Beverages:** ✅ Must use GRAS ingredients (same as food)

#### Additives & Preservatives
- **Conventional Food:**
  - Food additives require pre-market approval (21 CFR 171)
  - Preservatives must be listed by function (e.g., "sodium benzoate (preservative)")
- **Dietary Supplements:**
  - New dietary ingredients (NDI) require 75-day pre-market notification
  - Grandfathered ingredients exempt
- **Alcoholic Beverages:**
  - TTB maintains approved ingredients list
  - Some additives allowed in alcoholic beverages not permitted in food
- **Non-Alcoholic Beverages:**
  - Same as conventional food
  - Additional restrictions for bottled water (21 CFR 165.110)

#### Fortification
- **Conventional Food:**
  - Voluntary fortification allowed if meets standards
  - Required fortification for specific products (e.g., enriched flour)
  - Must meet FDA nutrient addition policy
- **Dietary Supplements:**
  - Primary purpose is supplementation
  - Dosage levels can exceed DV%
- **Alcoholic Beverages:**
  - Generally prohibited to fortify with vitamins/minerals
  - Exception: Some wine products
- **Non-Alcoholic Beverages:**
  - Voluntary fortification allowed
  - Must comply with nutrient addition policy
  - "Fortified" or "enriched" claims regulated

---

## Critical Differences Summary

### 1. **Agency Jurisdiction**
- **FDA (CFSAN):** Food, dietary supplements, non-alcoholic beverages
- **TTB:** Alcoholic beverages (with FDA oversight for nutrition if labeled)
- **Implication:** Different approval processes, different enforcement

### 2. **Mandatory vs. Optional Nutrition Labeling**
- **Mandatory:** Food, non-alcoholic beverages, dietary supplements (as "Supplement Facts")
- **Optional:** Alcoholic beverages (becomes mandatory if nutrition claim made)

### 3. **Health Claim Permissibility**
- **Strictest:** Alcoholic beverages (virtually no health claims)
- **Most Flexible:** Dietary supplements (structure/function claims allowed)
- **Middle Ground:** Food and beverages (only FDA-authorized health claims)

### 4. **Ingredient List Requirements**
- **Full Disclosure:** Food, non-alcoholic beverages, dietary supplements
- **Limited/Optional:** Alcoholic beverages (except allergens, sulfites)

### 5. **Product Classification Impact**
- A product's classification determines its entire regulatory framework
- Misclassification leads to complete non-compliance
- Borderline products (e.g., liquid dietary supplements vs. beverages) require careful analysis

---

## LabelCheck Implementation Implications

### Current Gaps:

1. **No Product Type Differentiation**
   - LabelCheck currently applies generic FDA food rules to all products
   - Alcoholic beverages evaluated incorrectly (FDA rules vs. TTB rules)
   - Dietary supplements not identified separately

2. **Incorrect Requirements Applied**
   - May require nutrition facts for alcoholic beverages when not mandatory
   - May not require "Supplement Facts" for dietary supplements
   - TTB-specific requirements not checked

3. **Health Claim Evaluation**
   - Structure/function claims flagged as violations for supplements (incorrect)
   - Health claims not prevented for alcoholic beverages (should be flagged)

4. **Missing Warnings**
   - Alcoholic beverage warning not checked
   - Dietary supplement disclaimer not verified

### Recommended Changes:

#### Priority 1: Add Product Type Detection
```typescript
enum ProductType {
  CONVENTIONAL_FOOD = 'conventional_food',
  DIETARY_SUPPLEMENT = 'dietary_supplement',
  ALCOHOLIC_BEVERAGE = 'alcoholic_beverage',
  NON_ALCOHOLIC_BEVERAGE = 'non_alcoholic_beverage'
}

// AI analysis should classify product type first
// Then apply category-specific rules
```

#### Priority 2: Category-Specific Rule Sets
```typescript
interface RegulatoryRules {
  requiresNutritionFacts: boolean;
  nutritionFactsFormat: 'standard' | 'supplement' | 'optional';
  allowsStructureFunctionClaims: boolean;
  allowsHealthClaims: boolean;
  requiresIngredientList: boolean;
  requiresAllergenStatement: boolean;
  requiresAlcoholWarning: boolean;
  regulatoryAuthority: 'FDA' | 'TTB' | 'FDA_TTB';
  specificRequirements: string[];
}
```

#### Priority 3: Enhanced Prompting
- Ask AI to identify product category first
- Apply category-specific analysis prompts
- Check category-specific requirements
- Provide category-appropriate recommendations

#### Priority 4: Warning Statement Checks
- Dietary supplement disclaimer (if structure/function claim present)
- Alcoholic beverage warning (27 CFR 16)
- Specific ingredient warnings (e.g., phenylketonurics warning for aspartame)

---

## Regulatory Reference Quick Guide

### Conventional Food
- **Primary:** 21 CFR Part 101 (Food Labeling)
- **Identity:** 21 CFR Part 102 (Common or Usual Names)
- **Standards:** 21 CFR Part 130-169 (Standards of Identity)
- **GRAS:** 21 CFR Part 170, 21 CFR Part 182-186

### Dietary Supplements
- **Primary:** 21 CFR 101.36 (Supplement Facts)
- **Law:** DSHEA 1994 (21 USC 343(r))
- **Structure/Function:** 21 USC 343(r)(6)
- **New Dietary Ingredients:** 21 CFR 190.6

### Alcoholic Beverages
- **Beer:** 27 CFR Part 7
- **Wine:** 27 CFR Part 4
- **Spirits:** 27 CFR Part 5
- **Warning:** 27 CFR Part 16
- **TTB Rulings:** TTB.gov/rulings

### Non-Alcoholic Beverages
- **General:** 21 CFR Part 101 (same as conventional food)
- **Bottled Water:** 21 CFR 165.110
- **Juice:** 21 CFR 102.33
- **Standards:** 21 CFR 165 (Beverages)

---

## Testing Scenarios for LabelCheck

### Scenario 1: Dietary Supplement Misidentified as Food
**Product:** Vitamin C supplement
**Current Behavior:** Flags "supports immune health" as violation
**Correct Behavior:** Allow structure/function claim, require supplement disclaimer

### Scenario 2: Beer Label Evaluated as Food
**Product:** Craft beer
**Current Behavior:** Flags missing nutrition facts, missing ingredient list
**Correct Behavior:** Nutrition facts optional, ingredient list optional, check for alcohol warning

### Scenario 3: Energy Drink Classification
**Product:** Energy drink with vitamins
**Issue:** Could be classified as food OR dietary supplement
**Correct Behavior:** Determine classification, apply appropriate rules

### Scenario 4: Kombucha (<0.5% ABV)
**Product:** Kombucha with 0.3% ABV
**Classification:** Non-alcoholic beverage (FDA)
**Correct Behavior:** FDA rules apply, not TTB

### Scenario 5: Wine with "Heart Healthy" Claim
**Product:** Red wine with health claim
**Current Behavior:** May not flag as violation
**Correct Behavior:** Strictly prohibited under 27 CFR 4.64

---

## Conclusion

The current LabelCheck implementation needs **product category detection and category-specific rule application** to provide accurate compliance analysis. The differences between conventional food, dietary supplements, alcoholic beverages, and non-alcoholic beverages are substantial and cannot be ignored.

### Immediate Actions Required:
1. Implement product type classification in AI analysis
2. Create separate regulatory rulesets for each category
3. Update prompts to include category-specific guidance
4. Add category-specific warning checks
5. Test with products from each category

### Success Metrics:
- Correct product classification: >95%
- Category-appropriate recommendations: 100%
- No false positives from wrong category rules
- Accurate identification of category-specific violations

---

## Next Steps

See `REGULATORY_IMPLEMENTATION_PLAN.md` for detailed implementation strategy.
