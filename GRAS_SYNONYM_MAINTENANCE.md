# GRAS Synonym Database Maintenance Guide

## Overview

The GRAS (Generally Recognized as Safe) database contains **1,487 ingredients** (as of October 2025). Synonyms are critical for matching ingredient names on labels to database entries, as ingredients can be listed with:
- Chemical names (e.g., "Ascorbic Acid" instead of "Vitamin C")
- Trade names
- Different chemical forms (e.g., "Calcium Carbonate" vs "Calcium Citrate")
- Stereoisomer prefixes (D-, L-, DL-)
- Percentage indicators (e.g., "1%")

## Current Coverage

- **18%+** of ingredients have synonyms
- **82%** need ongoing synonym enhancement
- Average: 2-3 synonyms per ingredient
- **Match rate: 100%** for common food ingredients (validated October 2025)

## Recent Updates

### October 2025 Database Enhancement - Phase 1
Added three critical missing ingredients identified during production testing:

1. **Ascorbyl Palmitate** (Vitamin C Ester)
   - Fat-soluble form of Vitamin C
   - Synonyms: vitamin c palmitate, E304, l-ascorbyl palmitate
   - Common in supplements and fortified foods

2. **Disodium Inosinate** (Flavor Enhancer)
   - Umami flavor enhancer, often paired with MSG
   - Synonyms: E631, sodium inosinate, IMP
   - Common in snack foods and seasonings

3. **Disodium Guanylate** (Flavor Enhancer)
   - Umami flavor enhancer, often paired with MSG
   - Synonyms: E627, sodium guanylate, GMP
   - Common in snack foods and seasonings

**Impact**: Achieved 100% match rate on 46 common ingredient test set.

### October 2025 Database Enhancement - Phase 2
**Critical Bug Fix**: Fixed Supabase pagination issue (1000-row server limit) preventing synonym matching for ingredients beyond first 1000 records.

**Added 19 high-priority ingredients** to eliminate fuzzy matching false positives:

**Preservatives & Leavening:**
- Calcium Propionate, Potassium Nitrate, Ammonium Bicarbonate
- Potassium Bicarbonate, Sodium Acid Pyrophosphate, Dipotassium Phosphate

**Emulsifiers & Stabilizers:**
- Calcium Stearate, Sodium Carboxymethylcellulose

**Proteins:**
- Whey Protein Isolate, Pea Protein Concentrate

**Minerals:**
- Calcium Sulfate, Ammonium Chloride

**Enzymes:**
- Protease, Amylase, Lipase, Glucose Oxidase, Invertase, Lactase

**Specialty:**
- Enzyme-Modified Lecithin

**Impact**:
- Match quality improved from 60% to **100% high-confidence** matches
- Eliminated all 20 fuzzy match false positives (40% → 0%)
- Database now contains **1,487 total ingredients** (was 1,468)

## Tools

### 1. Audit Current Coverage
```bash
node audit-gras-synonyms.js
```
Shows:
- Total coverage statistics
- Ingredients without synonyms
- Critical nutrient coverage
- Top ingredients by synonym count

### 2. Enhance Synonyms
```bash
node enhance-gras-synonyms.js
```
Adds comprehensive synonyms for common ingredients:
- All vitamins (with chemical names)
- All minerals (with salt forms)
- Common amino acids
- Sweeteners, preservatives, colors
- Fibers and additives

### 3. Test Ingredient Matching
```bash
node test-actual-ingredients.js
```
Tests 46 common ingredients against database using production matching logic
- Shows exact, synonym, and fuzzy match breakdown
- Calculates overall match rate
- Identifies missing ingredients

```bash
node test-ingredient-descriptions.js
```
Tests how descriptive names (e.g., "Vitamin C") map to database entries

### 4. Add Missing Ingredients
```bash
node add-missing-gras-ingredients.js
```
Template script for adding new ingredients with comprehensive synonyms
- Edit the `MISSING_INGREDIENTS` array before running
- Automatically checks for duplicates
- Verifies synonyms after insertion

### 5. Verify Database Entries
```bash
node verify-added-ingredients.js
```
Confirms ingredients were added correctly with all synonyms intact

## Adding New Synonyms

### Method 1: Edit enhance-gras-synonyms.js

Add entries to `SYNONYM_ENHANCEMENTS` object:

```javascript
const SYNONYM_ENHANCEMENTS = {
  'Ingredient Name': ['synonym1', 'synonym2', 'chemical name'],
  // Example:
  'Ascorbic Acid': ['vitamin C', 'vitamin c', 'ascorbate', 'E300'],
};
```

Then run:
```bash
node enhance-gras-synonyms.js
```

### Method 2: Direct Database Update

```javascript
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSynonym() {
  const { data } = await supabase
    .from('gras_ingredients')
    .select('*')
    .ilike('ingredient_name', 'Vitamin C')
    .maybeSingle();

  if (data) {
    const synonyms = data.synonyms || [];
    synonyms.push('ascorbic acid');

    await supabase
      .from('gras_ingredients')
      .update({ synonyms })
      .eq('id', data.id);
  }
}
```

## Matching Logic

The system uses three strategies to match ingredients:

### 1. Exact Match (after normalization)
```
"CALCIUM D-PANTOTHENATE"
  → normalize: "calcium pantothenate"
  → exact match: "Pantothenic Acid" (via synonym)
```

### 2. Synonym Match
```
"CHOLECALCIFEROL"
  → check synonyms of all ingredients
  → match: "Vitamin D" (synonym: "cholecalciferol")
```

### 3. Fuzzy Match
```
"GROUND ROASTED COFFEE"
  → split words: ["coffee", "roasted", "ground"]
  → try each word (reverse order)
  → match "coffee" → "Coffee" (prefer shorter matches)
```

## Normalization Rules

Before matching, ingredient names are normalized:

1. **Lowercase**: "VITAMIN C" → "vitamin c"
2. **Remove parentheses**: "COFFEE (ARABICA)" → "coffee"
3. **Remove stereoisomer prefixes**: "D-BIOTIN" → "biotin"
4. **Remove percentages**: "METHYLCOBALAMIN 1%" → "methylcobalamin"
5. **Trim whitespace**

See `lib/gras-helpers.ts`:
```typescript
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[,;].*$/, '')
    .replace(/\b(d|l|dl)-/gi, '')
    .replace(/\s+\d+%\s*$/, '')
    .trim();
}
```

## Priority Additions

Based on label analysis, prioritize synonyms for:

### Vitamins
- ✅ Vitamin C (Ascorbic Acid) - DONE
- ✅ Ascorbyl Palmitate (Fat-soluble Vitamin C) - DONE
- ✅ Vitamin B5 (Pantothenic Acid, Calcium Pantothenate) - DONE
- ✅ Vitamin B7 (Biotin, D-Biotin) - DONE
- ✅ Vitamin D (Cholecalciferol, Ergocalciferol) - DONE
- ✅ Vitamin B12 (Cobalamin, Methylcobalamin) - DONE

### Minerals
- ⚠️ Calcium forms (carbonate, citrate, phosphate, chloride)
- ⚠️ Iron forms (ferrous sulfate, ferrous fumarate, ferric pyrophosphate)
- ⚠️ Magnesium forms (oxide, citrate, sulfate)
- ⚠️ Zinc forms (oxide, gluconate, sulfate)
- ✅ Iodine (Potassium Iodide) - DONE

### Common Ingredients
- ⚠️ Coffee (roasted coffee, arabica, robusta)
- ✅ Inulin (chicory root fiber) - DONE
- ⚠️ Collagen (hydrolyzed collagen, collagen peptides)
- ⚠️ Protein forms (whey, casein, soy, pea)

## Monitoring Failed Matches

Check production logs for:
```
CRITICAL: Non-GRAS ingredients detected: [...]
```

If legitimate ingredients are flagged as non-GRAS:
1. Verify ingredient exists in database
2. Add missing synonyms
3. Re-test matching

## Best Practices

1. **Always add lowercase versions** of synonyms
2. **Include E-numbers** for European additives (e.g., E300 for Vitamin C)
3. **Add common misspellings** if frequently seen
4. **Include trade names** for branded ingredients
5. **Test after adding** synonyms with real labels
6. **Document source** for obscure synonyms

## Example: Complete Vitamin Entry

```javascript
{
  ingredient_name: "Ascorbic Acid",
  common_name: "Vitamin C",
  synonyms: [
    "vitamin C",
    "vitamin c",       // lowercase
    "ascorbate",       // chemical form
    "E300",           // E-number
    "l-ascorbic acid" // stereoisomer
  ],
  gras_status: "affirmed"
}
```

## Troubleshooting

### Problem: Ingredient not matching despite synonym
**Check**:
1. Is normalization removing critical parts? (test with normalizeIngredientName())
2. Is synonym spelled correctly? (check database directly)
3. Are there multiple entries with same name? (causes `.maybeSingle()` error)

### Problem: Wrong ingredient matched
**Cause**: Fuzzy matching too broad (matches common words like "calcium", "vitamin")
**Solution**: Make fuzzy match more specific by prioritizing:
- Exact word matches over partial matches
- Shorter ingredient names over longer ones
- Last word in multi-word ingredients

### Problem: Duplicate entries in database
**Solution**: Consolidate entries or update script to handle `.limit(1)` instead of `.maybeSingle()`

## Future Enhancements

1. **Auto-learn synonyms** from production mismatches
2. **Crowdsource synonym database** from user corrections
3. **API integration** with FDA GRAS notice updates
4. **ML-based fuzzy matching** for complex ingredient names
5. **Brand name database** for proprietary ingredients
