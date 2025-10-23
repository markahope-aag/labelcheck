# GRAS Database Documentation

## Overview

The GRAS (Generally Recognized as Safe) database system automatically checks food label ingredients against FDA-approved substances to identify potential regulatory violations.

## Current Status

- **Total Ingredients**: 100
- **Coverage**: ~84% match rate with real-world products
- **Categories**: 24 functional categories
- **Matching Strategies**: 3 (exact, synonym, fuzzy)

## Database Structure

### Table: `gras_ingredients`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `ingredient_name` | TEXT | Official ingredient name |
| `cas_number` | TEXT | Chemical Abstracts Service number |
| `gras_notice_number` | TEXT | FDA GRAS Notice number (e.g., "GRN 000123") |
| `gras_status` | TEXT | Status: `affirmed`, `notice`, `scogs`, `pending` |
| `source_reference` | TEXT | CFR citation or GRAS notice reference |
| `category` | TEXT | Functional category (e.g., "preservative", "sweetener") |
| `approved_uses` | TEXT[] | Array of approved food applications |
| `limitations` | TEXT | Usage limitations or conditions |
| `synonyms` | TEXT[] | Alternative names for matching |
| `common_name` | TEXT | Common/trade name |
| `technical_name` | TEXT | IUPAC or technical chemical name |
| `is_active` | BOOLEAN | Active status (default: true) |

## How It Works

### 1. Automatic Checking

When a label is analyzed (`/api/analyze`), the system:
1. Extracts ingredients from the AI analysis
2. Checks each ingredient against the GRAS database
3. Flags non-GRAS ingredients as **CRITICAL** violations
4. Adds compliance information to the analysis results

### 2. Matching Strategies

The system uses three matching strategies in order:

#### Strategy 1: Exact Match
```
"Water" → matches "Water" (case-insensitive)
"Sugar" → matches "Sugar"
```

#### Strategy 2: Synonym Match
```
"Vitamin C" → matches "Ascorbic Acid" via synonyms
"Sodium Chloride" → matches "Salt" via synonyms
"Vinegar" → matches "Acetic Acid" via synonyms
```

#### Strategy 3: Fuzzy Match
```
"Whey Protein" → matches "Whey Protein Concentrate" (partial string match)
"Carbonated Water" → matches "Water" (significant word match)
```

### 3. Critical Alerts

Non-GRAS ingredients trigger:
- **Priority**: CRITICAL
- **Recommendation**: Remove ingredient or obtain FDA approval
- **Regulation**: 21 CFR 170.3, 21 CFR 170.30
- **Compliance Status**: Updated to "non_compliant"

## Expanding the Database

### Option 1: Add Individual Ingredients

Create a JSON file with new ingredients and import:

```json
[
  {
    "ingredient_name": "Taurine",
    "gras_status": "notice",
    "gras_notice_number": "GRN 000261",
    "source_reference": "GRN 000261",
    "category": "amino acid",
    "synonyms": ["2-aminoethanesulfonic acid"],
    "common_name": "Taurine"
  }
]
```

Then run:
```bash
node import-gras-data.js
```

### Option 2: Download Full FDA Datasets

The FDA maintains three main GRAS databases:

1. **GRAS Notice Inventory** (1,279 substances, 1998-2025)
   - URL: https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=GRASNotices
   - Download Format: Excel
   - Contains: GRN number, substance name, date, FDA letter

2. **SCOGS Database** (381 substances, 1972-1980)
   - URL: https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=SCOGS
   - Download Format: Excel
   - Contains: GRAS substance, SCOGS report, CAS number, CFR citation

3. **CFR-Listed GRAS** (~200 substances)
   - Source: 21 CFR Parts 182 and 184
   - Format: PDF/HTML from ecfr.gov
   - Contains: Ingredient names, CFR sections, limitations

#### Steps to Import FDA Data:

1. Download Excel files from FDA websites
2. Convert to CSV or JSON
3. Create mapping script to match fields:
   ```javascript
   {
     "ingredient_name": row["Substance"],
     "gras_notice_number": row["GRN No."],
     "gras_status": "notice",
     "source_reference": row["FDA's Letter"]
   }
   ```
4. Run import script with new data

### Option 3: Use Pre-compiled Lists

Several organizations maintain GRAS ingredient lists:
- FDA's Everything Added to Food in the United States (EAFUS)
- USDA Branded Food Products Database
- Commercial food ingredient databases

## Common Missing Ingredients

Based on testing, consider adding:

### High Priority
- Taurine (energy drinks)
- Maltitol (sugar alcohol)
- Milk (whole milk as ingredient)
- Vitamin D (fortification)
- Soybean Oil (cooking oil)
- Egg Yolk (baking)
- Canola Oil
- Palm Oil
- Sunflower Oil

### Medium Priority
- Erythritol variants
- Monk fruit extract
- Allulose
- Beta-alanine
- L-carnitine
- CoQ10
- Probiotics (specific strains)

### Vitamins & Minerals
- Vitamin D2, D3
- Vitamin K
- Biotin
- Folic Acid
- Iron (various forms)
- Zinc (various forms)
- Magnesium (various forms)

## Testing

### Test Individual Ingredients
```bash
node test-gras-simple.js
```

### Test with Real Products
```bash
node test-expanded-gras.js
```

### Check Database Stats
```bash
node -e "const { createClient } = require('@supabase/supabase-js'); require('dotenv').config({ path: '.env.local' }); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('gras_ingredients').select('*', { count: 'exact', head: true }).then(({ count }) => console.log('Total ingredients:', count));"
```

## Maintenance

### Regular Updates

1. **Monthly**: Check FDA GRAS Notice Inventory for new substances
2. **Quarterly**: Review user feedback for common missing ingredients
3. **Annually**: Full sync with FDA databases

### Quality Assurance

- Verify CFR citations are current
- Update synonyms based on common name variations
- Remove deprecated or revoked GRAS determinations
- Add usage limitations where applicable

## Performance

### Current Performance
- Database queries: <50ms average
- Exact match: 1 query
- Synonym match: 1 query (all ingredients with synonyms)
- Fuzzy match: 1-5 queries (per significant word)
- Analysis overhead: ~200-500ms per label (depending on ingredient count)

### Optimization Tips
- Keep `is_active` flag maintained for fast filtering
- Add GIN indexes for array searches (already implemented)
- Cache frequently checked ingredients (future enhancement)
- Batch check ingredients in analysis route (already implemented)

## Integration Points

### Files Using GRAS Database

1. **`lib/gras-helpers.ts`**
   - Core GRAS checking functions
   - Three-strategy matching logic
   - Compliance report generation

2. **`app/api/analyze/route.ts`**
   - Automatic GRAS checking after AI analysis
   - Critical violation flagging
   - Compliance status updates

3. **`supabase/migrations/20251022220000_create_gras_ingredients.sql`**
   - Database schema definition
   - Indexes and triggers
   - Seed data

4. **`data/gras-common-ingredients.json`**
   - 80 common GRAS ingredients
   - Comprehensive synonyms
   - Category classifications

## References

- [FDA GRAS Notice Inventory](https://www.fda.gov/food/generally-recognized-safe-gras/gras-notice-inventory)
- [SCOGS Database](https://www.fda.gov/food/generally-recognized-safe-gras/scogs-database)
- [21 CFR Part 182 - Substances GRAS](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-182)
- [21 CFR Part 184 - Direct Food Substances Affirmed as GRAS](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-184)
- [FDA GRAS FAQs](https://www.fda.gov/food/generally-recognized-safe-gras/frequently-asked-questions-about-gras)

## Future Enhancements

### Short Term
- Add 50-100 more common ingredients
- Improve fuzzy matching accuracy
- Add ingredient usage limitations to alerts

### Medium Term
- Import full FDA GRAS Notice Inventory (1,279 substances)
- Add SCOGS database (381 substances)
- Implement caching for frequent ingredients

### Long Term
- Auto-update from FDA API (if available)
- Machine learning for better synonym matching
- User-contributed ingredient suggestions
- Regional/international GRAS databases (EU, Canada, etc.)

## Support

For questions or issues:
1. Check this documentation
2. Review test results: `test-gras-simple.js`, `test-expanded-gras.js`
3. Check Supabase logs for database errors
4. Verify environment variables are set correctly
