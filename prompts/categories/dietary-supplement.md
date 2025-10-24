# Dietary Supplement Regulatory Analysis

**Jurisdiction:** FDA (21 CFR 101.36, DSHEA)
**Product Category:** DIETARY_SUPPLEMENT

---

## STEP 1: INFORMATION EXTRACTION

Extract ALL of the following information from the label:

### A. Basic Label Elements
- **Statement of Identity**: Product name on principal display panel
  - Must include "dietary supplement" unless obvious from context
  - Check for misleading marketing terms: "Superfood", "Detox", "Cleanse", "Miracle", "Cure", "Treat"
- **Net Quantity**: Amount and units (must be in bottom 30% of display panel)
  - Either US customary OR metric may appear first - both orders are compliant
  - Secondary measurement in parentheses
- **Manufacturer/Distributor**: Name and complete address

### B. Supplement Facts Panel
- **CRITICAL**: Label MUST have "Supplement Facts" panel (NOT "Nutrition Facts")
- Extract:
  - Serving size
  - Amount per serving for each ingredient
  - % Daily Value (DV) for vitamins/minerals
  - Proprietary blend information (if applicable)
  - All active ingredients listed in panel

### C. Ingredient List
- **🚨 CRITICAL FOR SUPPLEMENTS**: Extract ingredients from TWO sources:
  1. Active ingredients from "Supplement Facts" panel (including proprietary blends)
  2. "Other Ingredients" or "Ingredients" list below the panel
- List all ingredients in order shown
- Note any flavors, colors, preservatives

### D. Claims and Statements
- **Scan ENTIRE label** including front panel, side panels, promotional text
- Extract ALL marketing claims, health statements, structure/function claims
- Note any implied health benefits

### E. Allergen Information
- Check for "Contains:" statement
- Check for parenthetical allergen declarations in ingredient list
- Identify any of the 9 major allergens: Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, Sesame

### F. Disclaimer Statement
- Look for: "This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease."
- Note exact wording and placement

---

## STEP 2: COMPLIANCE EVALUATION

### 1. STATEMENT OF IDENTITY

**Check:**
- Product name clear and prominent on principal display panel?
- Includes "dietary supplement" term (unless obvious)?
- **🚨 MISLEADING TERMS**: Does name contain any FDA-discouraged terms?
  - "Superfood" → Flag as potential violation (not defined by FDA)
  - "Detox"/"Cleanse" → Flag (implies disease treatment)
  - "Miracle" → Flag (exaggerated, unsubstantiated)
  - "Cure"/"Treat" → Flag (drug claims prohibited)

**Status Assignment:**
- Compliant: Proper identification, no misleading terms
- Potentially-Non-Compliant: Missing "dietary supplement" term but could be implied
- Non-Compliant: Misleading terms present, no clear identification

### 2. NET QUANTITY DECLARATION

**Check:**
- Proper declaration in weight, measure, or numerical count?
- In bottom 30% of display panel?
- Both US customary and metric units shown (either order acceptable)?

**Status Assignment:**
- Compliant: Meets all requirements
- Potentially-Non-Compliant: Cannot verify placement or unit conversion
- Non-Compliant: Missing units, improper placement, missing metric/US customary

### 3. SUPPLEMENT FACTS PANEL

**🚨 CRITICAL CHECK - Panel Type:**
- Does label show "Nutrition Facts" instead of "Supplement Facts"?
  - If YES → Status = NON-COMPLIANT
  - Explanation: "Dietary supplements must use Supplement Facts panel, not Nutrition Facts panel per 21 CFR 101.36"
- Does label lack any nutrition/supplement panel?
  - If YES → Status = NON-COMPLIANT
  - Explanation: "Supplement Facts panel is required but missing per 21 CFR 101.36"

**IF CORRECT PANEL TYPE PRESENT (Supplement Facts), validate:**
- Serving size clearly stated?
- Amount per serving listed for each dietary ingredient?
- % Daily Value shown for vitamins/minerals with established DVs?
- Proprietary blend disclosures comply (total weight shown)?
- Format compliance (title, headings, layout per 21 CFR 101.36)?

**Set in JSON:**
- `panel_type_present`: "Supplement Facts" | "Nutrition Facts" | "None"
- `panel_type_required`: "Supplement Facts"
- `panel_type_correct`: true | false
- `rounding_validation.status`: "not_applicable" (Supplement Facts don't use Nutrition Facts rounding rules)

**Status Assignment:**
- Compliant: Correct Supplement Facts panel with all required elements
- Potentially-Non-Compliant: Correct panel but missing some elements or illegible
- Non-Compliant: Wrong panel type OR missing panel entirely

### 4. INGREDIENT LIST

**🚨 CRITICAL**: Must extract from BOTH sources:
1. Active ingredients from Supplement Facts panel
2. Other ingredients from separate ingredients list

**Check:**
- All ingredients listed in descending order by weight?
- Artificial flavors, natural flavors properly declared?
- Colors specifically named?
- Preservatives listed with function?

**Status Assignment:**
- Compliant: Complete ingredient list, proper order and declarations
- Potentially-Non-Compliant: Some ingredients illegible or unclear
- Non-Compliant: Missing ingredient list, improper declarations

### 5. FOOD ALLERGEN LABELING (FALCPA/FASTER Act)

**🚨 APPLIES TO ALL DIETARY SUPPLEMENTS** per FALCPA Section 403(w)

**STEP 1**: Identify if ANY of the 9 major food allergens are present in ingredients:
- Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, Sesame

**STEP 2**: IF NO allergens present in ingredients:
- Status: "compliant"
- Explanation: "No major food allergens detected in ingredients. Product is compliant with FALCPA as there are no allergens to declare."

**STEP 3**: IF allergens ARE present:
- Check for "Contains:" statement OR parenthetical declarations
- All present allergens must be declared in plain language

**🚨 ABSOLUTE RULE**: ONLY use "potentially_non_compliant" or "non_compliant" if you have CONFIRMED allergens ARE PRESENT. If ZERO allergens detected, status MUST be "compliant".

**Status Assignment:**
- Compliant: No allergens present OR all present allergens properly declared
- Potentially-Non-Compliant: Allergens present, unclear if properly declared
- Non-Compliant: Allergens present but not declared

### 6. CLAIMS ANALYSIS

**🚨 SCAN ENTIRE LABEL** for all claims and marketing statements.

#### ACCEPTABLE CLAIMS (Flag as COMPLIANT):

**A. Nutrient Content Claims** (quantitative statements - 21 CFR 101.13):
- Examples: "High in vitamin C", "Good source of fiber", "Contains 100% DV of vitamin D"
- Validation: "High" ≥20% DV, "Good Source" 10-19% DV
- **❌ DISCLAIMER NOT REQUIRED**

**B. General Nutritional Statements** (factual information):
- Examples: "Contains 20 grams of protein", "Gluten-free", "Vegan", "Non-GMO"
- **❌ DISCLAIMER NOT REQUIRED**

**C. Structure/Function Claims** (LEGAL under DSHEA):
- Examples:
  - "Supports healthy immune system function"
  - "Promotes healthy joints and cartilage"
  - "Helps maintain healthy cholesterol levels already within normal range"
  - "Supports energy and stamina"
  - "Magnesium helps relax muscles"
  - "Zinc supports skin health"
  - "Vitamin D helps maintain healthy bones"
- **✅ DISCLAIMER REQUIRED**: Must have FDA disclaimer statement
- Must be truthful, not misleading, have substantiation

**D. General Well-Being Claims**:
- Examples: "Promotes vitality and energy", "Supports overall wellness"
- **✅ DISCLAIMER REQUIRED**

**E. Nutrient Deficiency Claims**:
- Examples: "Helps prevent vitamin D deficiency"
- **✅ DISCLAIMER REQUIRED**

**F. Sexual Health Structure/Function Claims** (SPECIAL SCRUTINY):
- **✅ ACCEPTABLE** (with required disclaimer):
  - "Supports healthy sexual function"
  - "Promotes sexual vitality"
  - "Enhances sexual wellness"
  - "Supports energy and stamina"
  - "Helps maintain normal testosterone levels already within normal range"
  - "Supports normal blood flow"
  - "May help improve sexual performance and pleasure" (ONLY if general wellness context, NOT disease)

- **⚠️ GRAY ZONE** - "pleasure" and "performance":
  - CAN be used ONLY if clearly relate to general well-being, NOT medical outcomes
  - ✅ Compliant: "Supports sexual performance and overall pleasure as part of a healthy lifestyle"
  - ❌ Noncompliant: "Improves performance for men with erectile dysfunction"

- **❌ PROHIBITED** - Sexual Disease/Dysfunction Claims:
  - "Treats erectile dysfunction" / "Cures impotence"
  - "Restores lost libido"
  - "Increases testosterone in men with low T" (implies treating condition)
  - "Prevents premature ejaculation"
  - "Works like Viagra" / "Natural Viagra alternative"
  - "Reverses sexual decline"

- **KEY DIFFERENTIATOR**: Any claim referencing or implying medical condition (ED, impotence, dysfunction, low T as disorder) = DRUG CLAIM = PROHIBITED

- **Note in recommendations**: "Sexual enhancement supplements are subject to heightened FDA/FTC scrutiny and substantiation requirements"

#### PROHIBITED CLAIMS (Flag as NON-COMPLIANT):

**Disease Treatment/Cure Claims**:
- Examples: "Cures arthritis", "Treats depression", "Reverses diabetes", "Prevents Alzheimer's", "Stops cancer"
- **🚫 NOT PERMITTED** - Adding disclaimer does NOT make these compliant
- These are drug claims, never allowed for dietary supplements

**For each claim, populate JSON:**
```json
{
  "claim_text": "Exact wording from label",
  "claim_type": "nutrient_content|health_claim|structure_function",
  "classification": "compliant|prohibited|needs_review",
  "rationale": "Why this classification was assigned"
}
```

### 7. DISCLAIMER REQUIREMENTS

**🚨 CRITICAL CHECK**: If ANY structure/function, well-being, or nutrient deficiency claims are present:

**Required disclaimer text (exact):**
"This statement has not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease."

**Check:**
- Is disclaimer required based on claims? (Yes if any S/F claims present)
- Is disclaimer present on label?
- Is wording correct? (Must match FDA requirement)

**Status Assignment:**
- Compliant: No S/F claims OR S/F claims with correct disclaimer
- Non-Compliant: S/F claims present but disclaimer missing or incorrect wording
- Not Applicable: No claims that require disclaimer

### 8. MANUFACTURER INFORMATION

**Check:**
- Manufacturer or distributor name present?
- Complete address with city, state, ZIP?
- Qualifying phrases correct ("distributed by", "manufactured for")?

**Status Assignment:**
- Compliant: Complete information present
- Potentially-Non-Compliant: Partial information or illegible
- Non-Compliant: Missing manufacturer/distributor information

---

## STEP 3: OVERALL ASSESSMENT

**Determine primary_compliance_status:**
- **Compliant**: Meets all dietary supplement requirements, no violations found
- **Potentially-Non-Compliant**: Likely violations present but depends on information not fully visible or verifiable
- **Non-Compliant**: Clear violations of supplement regulations (wrong panel type, prohibited claims, missing required elements)

**Provide 2-3 sentence summary** highlighting:
- Whether Supplement Facts panel is correct
- Major compliance issues found (if any)
- Critical areas needing attention

---

## STEP 4: RECOMMENDATIONS

**Prioritize recommendations:**
- **CRITICAL**: Must fix immediately (wrong panel type, prohibited drug claims, missing disclaimer)
- **HIGH**: Important compliance issues (incomplete allergen declarations, misleading terms)
- **MEDIUM**: Minor improvements (formatting, clarity)
- **LOW**: Best practice suggestions

**For each recommendation:**
- Specific, actionable instruction
- Relevant regulation citation (21 CFR section)
- Priority level

---

## REMEMBER: Category Confidence

Since you've been told this is a DIETARY_SUPPLEMENT, always set:
- `"category_confidence": "high"`
- `"category_ambiguity": { "is_ambiguous": false, ... }`

Only set `is_ambiguous: true` if you find STRONG evidence the classification was wrong (e.g., has Nutrition Facts panel, clearly marketed as food/beverage).
