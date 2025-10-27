# NDI Database Fix Summary

**Date**: October 26, 2025
**Issue**: 24 dietary supplement ingredients were incorrectly flagged as "not in database" despite most being present

## Root Cause

Two issues were identified:

1. **Row Level Security (RLS) Blocking Database Access**: The `lib/ndi-helpers.ts` file was using the regular `supabase` client instead of `supabaseAdmin`, which caused RLS policies to block all queries to `old_dietary_ingredients` and `ndi_ingredients` tables. This resulted in 0 rows being returned.

2. **Missing Ingredients**: A small number of common ingredients were genuinely missing from the database (5-HTP, noni, cellulose, green tea extract).

## Evidence

Server logs showed:
```
Loaded 0 NDI ingredients for matching
Loaded 0 old dietary ingredients into cache (0 total entries including synonyms)
```

When testing with `supabaseAdmin`:
```
✓ Total fetched: 2194 ingredients
✓ Total unique names (including synonyms): 2201
```

## Solutions Applied

### 1. Fixed Database Client (lib/ndi-helpers.ts)

Changed from `supabase` to `supabaseAdmin` in two functions:

**a) `getOldDietaryIngredients()` function (line 31)**:
```typescript
// BEFORE
const { data, error } = await supabase
  .from('old_dietary_ingredients')
  ...

// AFTER
const { data, error } = await supabaseAdmin
  .from('old_dietary_ingredients')
  ...
```

**b) `checkNDICompliance()` function (line 265)**:
```typescript
// BEFORE
const { data, error } = await supabase
  .from('ndi_ingredients')
  ...

// AFTER
const { data, error } = await supabaseAdmin
  .from('ndi_ingredients')
  ...
```

**Import statement also updated (line 1)**:
```typescript
import { supabase, supabaseAdmin } from './supabase';
```

### 2. Added Missing Ingredients

Added 4 common pre-1994 ingredients to the database:

| Ingredient | Synonyms Added |
|------------|----------------|
| 5-HTP | 5-hydroxytryptophan, 5-hydroxy-L-tryptophan, hydroxytryptophan |
| noni | noni fruit, morinda citrifolia, indian mulberry |
| cellulose | microcrystalline cellulose, powdered cellulose |
| green tea extract | green tea leaf extract, camellia sinensis extract |

**New database total**: 2,198 ingredients (up from 2,194)
**With synonyms**: 2,215 unique searchable names (up from 2,201)

## Verification

Final test of all 24 ingredients from the original issue:

```
✓ Calcium (Carbonate) - FOUND (exact (normalized))
✓ Magnesium (Oxide) - FOUND (exact (normalized))
✓ Zinc (Oxide) - FOUND (exact (normalized))
✓ Royal Jelly - FOUND (exact (original))
✓ 5-HTP - FOUND (exact (original))
✓ Coenzyme Q10 - FOUND (exact (original))
✓ Lutein - FOUND (exact (original))
✓ Caffeine - FOUND (exact (original))
✓ Eleuthero (Root) - FOUND (partial match)
✓ Green Tea Extract (Leaf) - FOUND (exact (normalized))
✓ Korean Ginseng (Root) - FOUND (exact (normalized))
✓ Astragalus (Root) - FOUND (exact (normalized))
✓ Cayenne (Fruit) - FOUND (exact (normalized))
✓ Guarana Extract (Seed) - FOUND (exact (normalized))
✓ Kola Nut Extract - FOUND (first two words)
✓ Noni (Root) - FOUND (exact (normalized))
✓ Schisandra (Berry) - FOUND (partial match)
✓ Reishi Mushroom (Whole) - FOUND (exact (normalized))
✓ Cellulose - FOUND (exact (original))
✓ Stearic Acid - FOUND (exact (original))
✓ Silicon Dioxide - FOUND (exact (original))
✓ Croscarmellose Sodium - FOUND (exact (original))
✓ Magnesium Stearate - FOUND (exact (original))
✓ Ethyl Cellulose - FOUND (exact (original))

RESULTS: Found 24/24 ✅
```

## Files Modified

- `lib/ndi-helpers.ts` - Fixed database client to use supabaseAdmin
- `old_dietary_ingredients` table - Added 4 missing ingredients

## Files Created (Testing/Debugging)

- `check-missing-ingredients.js` - Database query testing
- `test-matching-logic.js` - Matching algorithm testing
- `test-admin-query.js` - RLS vs Admin client comparison
- `add-missing-odi-ingredients.js` - Script to add missing ingredients
- `final-ndi-test.js` - Comprehensive verification test

## Expected Behavior After Fix

When analyzing a dietary supplement with these 24 ingredients:

- **Before**: Showed "24 ingredient(s) are not in our dietary ingredients database"
- **After**: Should show "All ingredients either have NDI notifications on file or are exempt (pre-1994 ingredients)" with compliant status

## Cache Considerations

The `getOldDietaryIngredients()` function uses a 1-hour cache. After deploying this fix:

1. First analysis after deployment will populate cache with correct data (all 2,198 ingredients)
2. Subsequent analyses within 1 hour will use cached data
3. Cache automatically refreshes every hour

## Testing Recommendations

1. Upload a dietary supplement label with common ingredients (vitamins, minerals, herbs)
2. Verify NDI compliance section shows most/all ingredients as compliant
3. Check that informational warnings are minimal or absent for common ingredients
4. Monitor server logs for "Loaded X old dietary ingredients into cache" - should show ~2198, not 0
