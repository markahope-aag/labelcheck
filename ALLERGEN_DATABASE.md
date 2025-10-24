# Allergen Database System

## Overview

The allergen database provides structured, reliable detection of the **9 FDA-recognized major food allergens** as required by FALCPA (Food Allergen Labeling and Consumer Protection Act) and the FASTER Act.

Similar to the GRAS ingredient database, this system uses exact matching and derivative lookup to detect hidden allergens in ingredient lists.

---

## The 9 Major Food Allergens

Per FDA requirements (FALCPA/FASTER Act), the following are major food allergens:

1. **Milk** (dairy)
2. **Eggs**
3. **Fish** (finned fish)
4. **Crustacean Shellfish**
5. **Tree Nuts**
6. **Peanuts**
7. **Wheat**
8. **Soybeans** (soy)
9. **Sesame** (added January 1, 2023 by FASTER Act)

---

## Database Schema

### `major_allergens` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `allergen_name` | TEXT | Official FDA allergen name (e.g., "Milk") |
| `allergen_category` | TEXT | Normalized category slug (e.g., "milk") |
| `common_name` | TEXT | Alternative common name (e.g., "Dairy") |
| `derivatives` | TEXT[] | Array of ingredient names containing this allergen |
| `scientific_names` | TEXT[] | Scientific/chemical names and protein markers |
| `cross_reactive_allergens` | TEXT[] | Related allergens (future use) |
| `is_active` | BOOLEAN | Active status flag |
| `notes` | TEXT | Additional regulatory notes |
| `regulation_citation` | TEXT | Legal reference (FALCPA/FASTER Act) |

---

## Setup Instructions

### Step 1: Apply Database Migration

The allergen database requires running a SQL migration to create the table and populate it with allergen data.

#### Option A: Via Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project
2. Click **SQL Editor** in the left sidebar
3. Create a new query
4. Copy the contents of `supabase/migrations/20251024100000_create_allergen_database.sql`
5. Paste into the SQL editor
6. Click **Run** to execute

#### Option B: Via Supabase CLI (if installed)
```bash
supabase db push
```

#### Option C: Via Database URL (if psql available)
```bash
psql $DATABASE_URL -f supabase/migrations/20251024100000_create_allergen_database.sql
```

### Step 2: Verify Installation

Run the test script to verify the database is working:

```bash
node test-allergen-detection.js
```

Expected output:
```
✅ Allergen database found: 9 allergen(s)
🔬 Testing MILK allergen derivatives:
   ✅ "Whey protein isolate" → Milk (derivative)
   ✅ "Sodium caseinate" → Milk (derivative)
   ...
📊 TEST RESULTS
✅ Passed: 60/60
📈 Success Rate: 100%
```

---

## Usage

### Basic Allergen Checking

```typescript
import { checkIngredientForAllergens } from '@/lib/allergen-helpers';

// Check a single ingredient
const results = await checkIngredientForAllergens('Whey protein');

if (results.length > 0) {
  console.log(`Contains: ${results[0].allergen?.allergen_name}`);
  // Output: "Contains: Milk"
}
```

### Batch Ingredient Checking

```typescript
import { checkIngredientsForAllergens } from '@/lib/allergen-helpers';

const ingredients = [
  'Wheat flour',
  'Sugar',
  'Soy lecithin',
  'Eggs',
  'Peanut oil',
];

const results = await checkIngredientsForAllergens(ingredients);

console.log(`Allergens detected: ${results.allergensDetected.length}`);
// Output: "Allergens detected: 4" (Wheat, Soybeans, Eggs, Peanuts)

console.log(`Ingredients with allergens: ${results.summary.ingredientsWithAllergens}`);
// Output: "Ingredients with allergens: 4"
```

---

## Matching Strategies

### 1. Exact Match (Highest Confidence)
Directly matches allergen names:
- "Milk" → Milk
- "Eggs" → Eggs
- "Wheat" → Wheat

### 2. Derivative Match (High Confidence)
Matches known derivatives from the `derivatives` array:
- "Whey" → Milk
- "Casein" → Milk
- "Albumin" → Eggs
- "Tofu" → Soybeans

### 3. Fuzzy Match (Medium Confidence)
Partial word matching for compound ingredients:
- "Wheat flour" → Wheat
- "Soy protein isolate" → Soybeans

---

## Derivative Coverage

### Milk (35+ derivatives)
- Casein, Caseinate, Whey, Lactose, Butter, Cream, Cheese, Ghee, Yogurt
- Milk powder, Lactoglobulin, Lactalbumin, Sodium caseinate
- Whey protein, Whey protein concentrate, Whey protein isolate
- **Hidden sources**: Caramel color (milk-derived), Artificial butter flavor

### Eggs (25+ derivatives)
- Albumin, Ovalbumin, Lecithin (egg-derived), Lysozyme
- Mayonnaise, Meringue, Egg white, Egg yolk
- **Hidden sources**: Surimi, Simplesse, Lecithin (check source)

### Fish (25+ species + derivatives)
- Anchovy, Bass, Cod, Salmon, Tuna, Tilapia, etc.
- Fish gelatin, Fish oil, Surimi, Isinglass, Fish sauce
- **Hidden sources**: Worcestershire sauce, Caesar dressing

### Crustacean Shellfish (15+ types)
- Crab, Lobster, Shrimp, Prawn, Crayfish, Krill
- **Hidden sources**: Chitosan, Glucosamine (shellfish-derived)

### Tree Nuts (20+ types)
- Almond, Cashew, Walnut, Hazelnut, Pecan, Pistachio, etc.
- Marzipan, Praline, Nougat, Nut butters, Nut oils
- **Note**: Coconut is botanically a tree nut but NOT a major allergen

### Peanuts (15+ derivatives)
- Peanut butter, Peanut oil, Groundnuts, Arachis oil
- **Hidden sources**: Hydrolyzed plant protein, Artificial nuts

### Wheat (35+ derivatives)
- Flour, Gluten, Semolina, Farina, Bulgur, Couscous, Seitan
- **Hidden sources**: Modified food starch (wheat-derived), Malt

### Soybeans (30+ derivatives)
- Tofu, Tempeh, Edamame, Miso, Soy sauce, Soy lecithin
- Soy protein isolate, Textured vegetable protein (TVP)
- **Hidden sources**: MSG (may be soy-derived), Vegetable protein

### Sesame (15+ derivatives)
- Sesame seeds, Sesame oil, Tahini, Benne, Til
- **Note**: Became 9th major allergen January 1, 2023 (FASTER Act)

---

## Integration with Analysis API

### Current Implementation (AI-Based)
Location: `app/api/analyze/route.ts` (line 411-417)

The AI prompt currently includes allergen detection logic that:
1. Identifies major food allergens in ingredients
2. Checks for "Contains:" statements
3. Validates proper declarations

### Enhanced Implementation (Database + AI)
Combine database lookup with AI analysis for maximum accuracy:

```typescript
// 1. Extract ingredients from label (AI)
const ingredients = analysisResult.ingredients;

// 2. Database lookup for allergen detection
const allergenResults = await checkIngredientsForAllergens(ingredients);

// 3. Cross-reference with AI-detected allergens
// 4. Flag discrepancies for review
```

**Benefits**:
- ✅ Structured, reliable allergen detection
- ✅ Catches hidden allergen sources (e.g., "whey" = milk)
- ✅ Reduces false negatives
- ✅ Provides confidence scores
- ✅ Supports synonym matching

---

## Maintenance

### Adding New Derivatives

If a derivative is missing from the database:

```sql
UPDATE major_allergens
SET derivatives = array_append(derivatives, 'new-derivative-name')
WHERE allergen_name = 'Milk';
```

Or via script:

```javascript
const { data } = await supabase
  .from('major_allergens')
  .select('*')
  .eq('allergen_name', 'Milk')
  .single();

const updatedDerivatives = [...data.derivatives, 'new-derivative'];

await supabase
  .from('major_allergens')
  .update({ derivatives: updatedDerivatives })
  .eq('id', data.id);
```

### Testing New Derivatives

After adding derivatives, test with:

```bash
node test-allergen-detection.js
```

---

## Regulatory Compliance

### FALCPA Requirements
- **Must declare** if any of the 9 major allergens are present
- **Two acceptable formats**:
  1. Parenthetical: "Whey (milk)"
  2. Contains statement: "Contains: Milk, Eggs, Wheat"

### FASTER Act (Effective January 1, 2023)
- **Added Sesame** as 9th major allergen
- Previous voluntary sesame declarations are now **mandatory**

### Cross-Contamination Warnings
- "May contain..." statements are **voluntary**
- "Processed in a facility that also processes..." is **voluntary**
- These are good manufacturing practices but NOT FDA-required

---

## Limitations

1. **Not a substitute for legal review**: Always consult FDA regulations
2. **Mollusks not included**: Clams, oysters, scallops are NOT major allergens
3. **Coconut not included**: Botanically a tree nut, but NOT a major allergen
4. **Sulfites**: Separately regulated (≥10 ppm threshold), not a major allergen

---

## Future Enhancements

1. **Sub-allergen tracking**: Specific tree nut types (almonds, cashews, etc.)
2. **Cross-reactivity database**: Allergies with related triggers
3. **International allergens**: EU has 14 major allergens (includes celery, mustard, lupin)
4. **Severity ratings**: Common allergen severity levels
5. **Auto-learning**: Add derivatives from production usage

---

## Files

**Database**:
- `supabase/migrations/20251024100000_create_allergen_database.sql` - Table schema and data

**Code**:
- `lib/allergen-helpers.ts` - TypeScript helper functions
- `test-allergen-detection.js` - Comprehensive test suite

**Documentation**:
- `ALLERGEN_DATABASE.md` - This file

---

## Support

For questions or issues:
1. Check test results: `node test-allergen-detection.js`
2. Verify migration applied: Check Supabase Dashboard → Database → Tables
3. Review FDA regulations: [FDA Allergen Guidance](https://www.fda.gov/food/food-labeling-nutrition/food-allergies)

---

**Status**: ✅ Ready for implementation
**Database Records**: 9 major allergens + 200+ derivatives
**Test Coverage**: 60+ test cases
**Regulatory Compliance**: FALCPA + FASTER Act
