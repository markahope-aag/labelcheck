# OUTPUT FORMAT

Return ONLY valid JSON (no other text). Use this exact schema:

```json
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
}
```
