# Non-Alcoholic Beverage Regulatory Analysis

**Jurisdiction:** FDA (21 CFR 101.9, 21 CFR Part 101)
**Product Category:** NON_ALCOHOLIC_BEVERAGE

---

## STEP 1: INFORMATION EXTRACTION

Extract ALL of the following information from the label:

### A. Basic Label Elements
- **Statement of Identity**: Product name on principal display panel
  - Check for misleading or fanciful terms
  - Verify beverage type indication (juice, drink, cocktail, punch, ade, water, etc.)
  - Look for misleading terms: "Natural", "Pure", "Fresh" (when not applicable)
- **Net Quantity**: Volume declaration (must be in bottom 30% of display panel)
  - Either US customary OR metric may appear first - both orders are compliant
  - Typically in fl oz (fluid ounces) and mL (milliliters)
- **Manufacturer/Distributor**: Name and complete address

### B. Nutrition Facts Panel
- **CRITICAL**: Label MUST have "Nutrition Facts" panel (NOT "Supplement Facts")
- Extract:
  - Serving size (typically in fl oz and mL)
  - Servings per container
  - Calories per serving
  - Total Fat, Saturated Fat, Trans Fat
  - Cholesterol
  - Sodium
  - Total Carbohydrate
  - Dietary Fiber
  - Total Sugars
  - Added Sugars (required as of 2020)
  - Protein
  - Vitamin D, Calcium, Iron, Potassium
  - Any additional fortified nutrients

### C. Ingredient List
- **CRITICAL**: Extract ALL ingredients in order listed
- Note:
  - Water (typically first ingredient in most beverages)
  - Sweeteners (sugar, high fructose corn syrup, artificial sweeteners)
  - Juices or juice concentrates
  - Natural and artificial flavors
  - Colors (must be specifically named)
  - Preservatives (with function)
  - Caffeine sources (if applicable)
  - Acids (citric acid, malic acid, etc.)

### D. Caffeine Disclosure
- Check for "Contains Caffeine" statement or caffeine amount
- Note if caffeine is added vs. naturally occurring
- Check for energy drink labeling

### E. Juice Percentage Declaration
- If "juice" appears in product name, check for percent juice declaration
- Note juice type and percentage
- Check for "from concentrate" designation

### F. Claims and Statements
- **Scan ENTIRE label** including front panel, side panels, promotional text
- Extract ALL nutrient content claims, health claims, marketing statements
- Note any implied health benefits or misleading terms

### G. Allergen Information
- Check for "Contains:" statement
- Check for parenthetical allergen declarations in ingredient list
- Identify any of the 9 major allergens: Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, Sesame

### H. Additional Elements
- Look for "Shake well" or similar instructions (required for some juice products)
- Check for fortification disclosure
- Note any organic, Non-GMO, or certification marks

---

## STEP 2: COMPLIANCE EVALUATION

### 1. STATEMENT OF IDENTITY

**Check:**
- Product name clear and prominent on principal display panel?
- Beverage type accurately described?
- **🚨 MISLEADING TERMS**: Does name contain potentially misleading terms?
  - "Pure" → Must be 100% juice with nothing added (if juice product)
  - "Fresh" → Must be fresh, never heated, not from concentrate
  - "Natural" → All ingredients must be natural (no artificial flavors/colors)
  - "Organic" → Must meet USDA organic requirements
  - Fanciful names must not mislead about ingredients/content

**Status Assignment:**
- Compliant: Accurate identification, no misleading terms
- Potentially-Non-Compliant: Unclear terminology or insufficient information visible
- Non-Compliant: Misleading terms present, inaccurate product identification

### 2. NET QUANTITY DECLARATION

**Check:**
- Proper declaration in fluid ounces (fl oz)?
- Metric equivalent in milliliters (mL) shown?
- In bottom 30% of principal display panel?
- Both US customary and metric units shown (either order acceptable)?
- Proper abbreviations used ("fl oz" not "oz", "mL" not "ml")?

**Status Assignment:**
- Compliant: Meets all requirements
- Potentially-Non-Compliant: Cannot verify placement or unit conversion accuracy
- Non-Compliant: Missing units, improper placement, missing metric/US customary

### 3. NUTRITION FACTS PANEL

**🚨 CRITICAL CHECK - Panel Type:**
- Does label show "Supplement Facts" instead of "Nutrition Facts"?
  - If YES → Status = NON-COMPLIANT
  - Explanation: "Non-alcoholic beverages must use Nutrition Facts panel, not Supplement Facts panel per 21 CFR 101.9"
- Does label lack any nutrition panel?
  - If YES → Status = NON-COMPLIANT (unless exempted - see note below)
  - Explanation: "Nutrition Facts panel is required but missing per 21 CFR 101.9"
- **EXEMPTION**: Some small businesses or very small packages may be exempt

**IF CORRECT PANEL TYPE PRESENT (Nutrition Facts), validate:**
- Serving size clearly stated in fl oz and mL?
- Servings per container declared?
- All required nutrients listed (calories, fats, cholesterol, sodium, carbs, sugars, added sugars, protein)?
- % Daily Values shown for applicable nutrients?
- Format compliance (title, headings, layout per 21 CFR 101.9)?

**Rounding Validation (SAME AS CONVENTIONAL FOOD):**
- **Calories**: <5 → express as 0; 5-50 → nearest 5; >50 → nearest 10
- **Total Fat**: <0.5g → express as 0; ≥0.5g → nearest 0.5g increment up to 5g, then nearest 1g
- **Saturated Fat**: <0.5g → express as 0; ≥0.5g → nearest 0.5g increment
- **Trans Fat**: <0.5g → express as 0; ≥0.5g → nearest 0.5g increment
- **Cholesterol**: <2mg → express as 0; 2-5mg → <5mg allowed; ≥5mg → nearest 5mg
- **Sodium**: <5mg → express as 0; 5-140mg → nearest 5mg; >140mg → nearest 10mg
- **Total Carbohydrate**: <0.5g → express as 0; ≥0.5g → nearest 1g
- **Dietary Fiber**: <0.5g → express as 0; ≥0.5g → nearest 1g
- **Sugars** (Total and Added): <0.5g → express as 0; ≥0.5g → nearest 1g
- **Protein**: <0.5g → express as 0; ≥0.5g → nearest 1g
- **Vitamins/Minerals**: Round to nearest whole percent or actual amount

**Set in JSON:**
- `panel_type_present`: "Nutrition Facts" | "Supplement Facts" | "None"
- `panel_type_required`: "Nutrition Facts"
- `panel_type_correct`: true | false
- `rounding_validation.status`: "compliant" | "non_compliant" | "not_verifiable"
- `rounding_validation.issues`: Array of specific rounding errors found

**Status Assignment:**
- Compliant: Correct Nutrition Facts panel with all required elements and proper rounding
- Potentially-Non-Compliant: Correct panel but some elements illegible or not verifiable
- Non-Compliant: Wrong panel type, missing panel, or rounding violations

### 4. INGREDIENT LIST

**Check:**
- All ingredients listed in descending order by weight (predominance)?
- **Water listed**: Water is typically the first ingredient in most beverages - must be listed
- Sweeteners properly declared (sugar, HFCS, sucrose, fructose, artificial sweeteners)?
- Juices or juice concentrates properly named?
- Natural and artificial flavors declared?
- Colors specifically named (not just "artificial color")?
- Preservatives listed with function (e.g., "sodium benzoate (preservative)")?
- Sub-ingredients declared for complex ingredients when required?

**Status Assignment:**
- Compliant: Complete ingredient list, proper order and declarations
- Potentially-Non-Compliant: Some ingredients illegible or order unclear
- Non-Compliant: Missing ingredient list, improper declarations, water not listed

### 5. CAFFEINE DISCLOSURE REQUIREMENTS

**STEP 1**: Determine if caffeine is present:
- Added caffeine (from caffeine powder, caffeine citrate, etc.)
- Natural caffeine sources (guarana, yerba mate, kola nut, green tea extract, coffee extract)

**STEP 2**: IF NO caffeine present:
- Status: "compliant"
- Explanation: "No caffeine detected. No disclosure required."

**STEP 3**: IF caffeine IS present (added OR natural source):
- **🚨 REQUIRED DISCLOSURES**:
  - Option 1: Statement "Contains Caffeine" on label
  - Option 2: Caffeine amount in mg per serving
  - Option 3 (BEST PRACTICE): Both statement AND amount
- Energy drinks should prominently display caffeine content

**Status Assignment:**
- Compliant: No caffeine present OR caffeine properly disclosed
- Potentially-Non-Compliant: Caffeine source present but disclosure unclear
- Non-Compliant: Caffeine present but no disclosure

### 6. JUICE PERCENTAGE DECLARATION

**STEP 1**: Check if "juice" appears in product name, flavor designation, or prominently on label

**STEP 2**: IF "juice" NOT in name/flavor:
- Status: "not_applicable"
- No percentage declaration required

**STEP 3**: IF "juice" IS in name/flavor:
- **🚨 REQUIRED**: Percent juice declaration (21 CFR 101.30)
- Must be on information panel
- Format: "Contains ___% juice" or "___% Juice"
- **"100% Juice" claims**: Must be 100% juice (no added water, sugars, or other ingredients except allowed additives like vitamin C)

**Check for juice name accuracy:**
- "Orange Juice" → Must be 100% orange juice
- "Orange Juice Drink" → Implies <100% juice, percentage required
- "Orange Drink" → May contain no juice, but if any juice present, percentage required
- "Orange Ade" → Typically <100% juice, percentage required
- "Orange Flavored Beverage" → May be just flavoring (no real juice required)

**Status Assignment:**
- Compliant: No juice in name OR proper percentage declared
- Potentially-Non-Compliant: "Juice" in name but percentage declaration unclear/illegible
- Non-Compliant: "Juice" in name but percentage missing or inaccurate claim

### 7. FOOD ALLERGEN LABELING (FALCPA/FASTER Act)

**🚨 APPLIES TO ALL FOOD PRODUCTS** per FALCPA Section 403(w)

**STEP 1**: Identify if ANY of the 9 major food allergens are present in ingredients:
- Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, Sesame

**STEP 2**: IF NO allergens present in ingredients:
- Status: "compliant"
- Explanation: "No major food allergens detected in ingredients. Product is compliant with FALCPA as there are no allergens to declare."

**STEP 3**: IF allergens ARE present:
- Check for "Contains:" statement OR parenthetical declarations
- All present allergens must be declared in plain language
- Common allergens in beverages: Milk (in some coffee drinks, protein drinks), Soy (lecithin), Tree nuts (almond milk, coconut)

**🚨 ABSOLUTE RULE**: ONLY use "potentially_non_compliant" or "non_compliant" if you have CONFIRMED allergens ARE PRESENT. If ZERO allergens detected, status MUST be "compliant".

**Status Assignment:**
- Compliant: No allergens present OR all present allergens properly declared
- Potentially-Non-Compliant: Allergens present, unclear if properly declared
- Non-Compliant: Allergens present but not declared

### 8. NUTRIENT CONTENT CLAIMS VALIDATION

**IF claims are present** (e.g., "Low Calorie", "Sugar Free", "High in Vitamin C"):

**Check validity per 21 CFR 101.13 and 101.54-101.62:**

**Common Beverage Claims:**
- **"Calorie Free"**: <5 calories per serving
- **"Low Calorie"**: ≤40 calories per serving (for beverages: per 240 mL)
- **"Sugar Free"**: <0.5g sugars per serving
- **"No Added Sugars"**: No sugars or sugar-containing ingredients added during processing
  - Must declare "Not a Low Calorie Food" if not also low calorie
- **"High" or "Excellent Source"**: ≥20% Daily Value per serving
- **"Good Source"**: 10-19% Daily Value per serving
- **"Light" or "Lite"** (for calories): 1/3 fewer calories OR 50% less fat than reference food
- **"Reduced Sugar"**: At least 25% less sugar than reference food

**For EACH claim found:**
```json
{
  "claim_text": "Exact wording from label",
  "claim_type": "nutrient_content|health_claim",
  "classification": "compliant|non_compliant|needs_review",
  "rationale": "Why this classification was assigned with specific requirements"
}
```

**Status Assignment:**
- Compliant: All claims meet regulatory definitions
- Potentially-Non-Compliant: Claims present but cannot verify against Nutrition Facts
- Non-Compliant: Claims do not meet regulatory definitions

### 9. FORTIFICATION POLICY COMPLIANCE

**Check if vitamins/minerals have been added:**
- Review ingredient list for added nutrients (vitamin C, calcium, vitamin D, etc.)
- Review Nutrition Facts for fortification levels

**FDA Fortification Policy** (21 CFR 104.20):
- **Generally NOT appropriate** for carbonated beverages (sodas)
- **Generally NOT appropriate** for candies, snack foods
- **May be appropriate** for:
  - Foods consumed as meal replacements
  - Foods for special dietary uses
  - Restoration of nutrients lost in processing

**🚨 CARBONATED BEVERAGE CHECK**:
- Is this a carbonated beverage (soda, sparkling water, etc.)?
- If YES + fortified → Flag for review
- Exception: Products marketed as nutritional beverages may be acceptable

**Status Assignment:**
- Compliant: No inappropriate fortification OR fortification is appropriate for product type
- Potentially-Non-Compliant: Fortification present, unclear if appropriate
- Non-Compliant: Inappropriate fortification (e.g., carbonated soda with added vitamins)

### 10. MANUFACTURER INFORMATION

**Check:**
- Manufacturer or distributor name present?
- Complete address with city, state, ZIP?
- Qualifying phrases correct ("distributed by", "manufactured for", "packed by")?

**Status Assignment:**
- Compliant: Complete information present
- Potentially-Non-Compliant: Partial information or illegible
- Non-Compliant: Missing manufacturer/distributor information

---

## STEP 3: OVERALL ASSESSMENT

**Determine primary_compliance_status:**
- **Compliant**: Meets all non-alcoholic beverage requirements, no violations found
- **Potentially-Non-Compliant**: Likely violations present but depends on information not fully visible or verifiable
- **Non-Compliant**: Clear violations of beverage regulations (wrong panel type, missing required declarations, false claims, rounding violations)

**Provide 2-3 sentence summary** highlighting:
- Whether Nutrition Facts panel is correct and complete
- Major compliance issues found (if any)
- Critical areas needing attention

---

## STEP 4: RECOMMENDATIONS

**Prioritize recommendations:**
- **CRITICAL**: Must fix immediately (wrong panel type, missing juice percentage, allergen violations, false claims)
- **HIGH**: Important compliance issues (rounding errors, missing caffeine disclosure, incomplete ingredient list)
- **MEDIUM**: Minor improvements (formatting, clarity, best practices)
- **LOW**: Suggestions for optimization (additional certifications, improved labeling)

**For each recommendation:**
- Specific, actionable instruction
- Relevant regulation citation (21 CFR section)
- Priority level
- Example correction if applicable

**Example recommendations:**
- CRITICAL: "Change panel header from 'Supplement Facts' to 'Nutrition Facts' per 21 CFR 101.9(a)"
- HIGH: "Add percent juice declaration on information panel as product name contains 'juice' per 21 CFR 101.30"
- MEDIUM: "Verify Total Sugars rounding - showing 8g but calculation suggests 7.6g which should round to 8g (compliant) per 21 CFR 101.9(c)(1)"
- LOW: "Consider adding caffeine amount in mg per serving for transparency (currently only states 'Contains Caffeine')"

---

## REMEMBER: Category Confidence

Since you've been told this is a NON_ALCOHOLIC_BEVERAGE, always set:
- `"category_confidence": "high"`
- `"category_ambiguity": { "is_ambiguous": false, ... }`

Only set `is_ambiguous: true` if you find STRONG evidence the classification was wrong (e.g., has Supplement Facts panel, clearly marketed as dietary supplement, or appears to be an alcoholic beverage with ≥0.5% ABV).
