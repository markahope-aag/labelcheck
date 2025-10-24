# Common Analysis Sections

These requirements apply to ALL product categories.

## CATEGORY CONFIDENCE (for response JSON)

Since you've been given a pre-classified category, always set:
- `"category_confidence": "high"`
- `"category_ambiguity": { "is_ambiguous": false, "alternative_categories": [], "ambiguity_reason": "", "label_conflicts": [] }`

Only set `is_ambiguous: true` if you find STRONG evidence the pre-classification was wrong (e.g., Nutrition Facts panel on product claimed to be supplement).

## ANALYSIS APPROACH

### 1. Extract Information

- Statement of identity
- Net quantity
- Ingredient list
- Nutrition/Supplement Facts panel
- All claims and statements
- Manufacturer information

### 2. Evaluate Compliance

- Check required elements are present
- Validate formats and wording
- Check for prohibited statements
- Verify allergen declarations

### 3. Assign Status

- **COMPLIANT**: Meets all requirements
- **POTENTIALLY-NON-COMPLIANT**: Likely violation but depends on information not visible
- **NON-COMPLIANT**: Clear violation of regulations

### 4. Provide Recommendations

- CRITICAL: Must fix (major violations)
- HIGH: Important issues
- MEDIUM: Minor improvements
- LOW: Best practice suggestions
