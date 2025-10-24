# Conventional Food Regulatory Analysis

**Jurisdiction:** FDA (21 CFR 101, FSIS/USDA for meat/poultry)
**Product Category:** CONVENTIONAL_FOOD

---

## STEP 1: INFORMATION EXTRACTION

Extract ALL of the following from the label:

### A. Basic Elements
- **Statement of Identity**: Product name (common/usual name)
  - Check for misleading terms: "Superfood", "Detox", "Cleanse", "Miracle", "Cure", "Treat"
- **Net Quantity**: Amount and units (bottom 30% of display panel)
  - US customary OR metric first (both orders compliant), secondary in parentheses
- **Manufacturer/Distributor**: Name and complete address

### B. Nutrition Facts Panel
- **MUST have "Nutrition Facts" panel (NOT "Supplement Facts")**
- Extract ALL values: Serving size, Servings per container, Calories, Total Fat, Saturated Fat, Trans Fat, Cholesterol, Sodium, Total Carbohydrate, Dietary Fiber, Total Sugars, Added Sugars, Protein, Vitamin D, Calcium, Iron, Potassium, plus any additional nutrients

### C. Ingredient List
- Extract all ingredients in order shown
- Note sub-ingredients, flavors, colors, preservatives

### D. Claims
- Scan ENTIRE label for nutrient content claims, health claims, marketing statements

### E. Allergen Information
- Check for "Contains:" statement or parenthetical declarations
- Identify any of 9 major allergens: Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, Sesame

---

## STEP 2: COMPLIANCE EVALUATION

### 1. STATEMENT OF IDENTITY

Check:
- Product name clear and prominent?
- Uses common/usual name?
- **🚨 MISLEADING TERMS**: "Superfood" (not FDA-defined), "Detox"/"Cleanse" (disease treatment), "Miracle" (exaggerated), "Cure"/"Treat" (drug claims)

Status: Compliant | Potentially-Non-Compliant | Non-Compliant

### 2. NET QUANTITY

Check: Proper units, bottom 30%, both US/metric

Status: Compliant | Potentially-Non-Compliant | Non-Compliant

### 3. NUTRITION FACTS PANEL

**🚨 CRITICAL - Panel Type:**
- Has "Supplement Facts" instead? → NON-COMPLIANT ("Conventional foods must use Nutrition Facts panel per 21 CFR 101.9")
- Missing panel when required? → NON-COMPLIANT

**IF NUTRITION FACTS PRESENT, validate:**

#### A. Format: Title, serving size, all required nutrients, proper bold/indent

#### B. Rounding Validation (21 CFR 101.9(c)) - 🚨 CRITICAL

**Calories:**
- <5 cal → 0
- 5-50 cal → nearest 5
- >50 cal → nearest 10

**Fat/Sat Fat/Trans Fat/Cholesterol/Sodium:**
- <0.5g (or <2mg chol, <5mg sodium) → 0
- <5g (or <50mg) → nearest 0.5g (or 5mg)
- ≥5g (or ≥50mg) → nearest 1g (or 10mg)

**Carb/Fiber/Sugars/Protein:**
- <1g → "less than 1g" or 0 if <0.5g
- ≥1g → nearest 1g

**Vitamins/Minerals (as % DV):**
- <2% → may use 0 or "<2%"
- ≥2% → nearest 2% increment

Check for rounding errors, mathematical impossibilities

Set in JSON:
- `panel_type_present`, `panel_type_required`, `panel_type_correct`
- `rounding_validation.status`: "compliant" | "non_compliant" | "not_applicable"
- `rounding_validation.errors`: Array of specific errors

Status: Compliant | Potentially-Non-Compliant | Non-Compliant

### 4. INGREDIENT LIST

Check: Descending order, sub-ingredients in parentheses, flavors/colors/preservatives proper

Status: Compliant | Potentially-Non-Compliant | Non-Compliant

### 5. ALLERGEN LABELING (FALCPA/FASTER)

**STEP 1**: Are ANY of 9 major allergens present in ingredients?

**STEP 2**: IF NO → Status: "compliant" ("No major food allergens detected")

**STEP 3**: IF YES → Check "Contains:" or parenthetical declarations

**🚨 RULE**: ONLY "potentially_non_compliant"/"non_compliant" if allergens CONFIRMED PRESENT. Zero allergens = "compliant".

Status: Compliant | Potentially-Non-Compliant | Non-Compliant

### 6. NUTRIENT CONTENT CLAIMS (if present)

Validate against 21 CFR 101.13:
- "Low fat": ≤3g/serving
- "Low sodium": ≤140mg/serving
- "High"/"Excellent source": ≥20% DV/serving
- "Good source": 10-19% DV/serving
- "Free": <0.5g/serving (or <5 cal)
- "Light": 1/3 fewer cal OR 50% less fat
- "Reduced": 25% less than reference

Check nutrition panel supports claim

Populate JSON for each claim:
```json
{
  "claim_text": "...",
  "claim_type": "nutrient_content",
  "classification": "compliant|prohibited|needs_review",
  "rationale": "..."
}
```

### 7. HEALTH CLAIMS (if present)

Check if using authorized FDA claim with exact wording:
- Calcium/vitamin D and osteoporosis
- Sodium and hypertension
- Dietary fat and cancer
- Fiber and coronary heart disease
- Soy protein and heart disease
- Plant sterol/stanol esters and heart disease
- etc.

Flag unauthorized claims as NON-COMPLIANT

### 8. FORTIFICATION POLICY

If fortified (vitamins/minerals added):
- Appropriate vehicle? (staple grains OK, candy/soda generally not)
- Restoring nutrients lost in processing?
- Creates nutrient imbalance?

---

## STEP 3: OVERALL ASSESSMENT

Determine primary_compliance_status:
- **Compliant**: Meets all requirements
- **Potentially-Non-Compliant**: Likely violations, depends on missing info
- **Non-Compliant**: Clear violations (wrong panel, false claims, rounding errors)

Provide 2-3 sentence summary: Nutrition Facts panel correct? Major issues? Critical areas?

---

## STEP 4: RECOMMENDATIONS

Prioritize:
- **CRITICAL**: Wrong panel, false claims, missing allergens, rounding violations
- **HIGH**: Incomplete info, unclear claims
- **MEDIUM**: Minor formatting
- **LOW**: Best practices

Each: Specific action, regulation citation, priority

---

## REMEMBER: Category Confidence

Since this is CONVENTIONAL_FOOD, set:
- `"category_confidence": "high"`
- `"category_ambiguity": { "is_ambiguous": false, ... }`

Only `is_ambiguous: true` if STRONG evidence wrong (e.g., Supplement Facts panel, TTB alcohol warning)
