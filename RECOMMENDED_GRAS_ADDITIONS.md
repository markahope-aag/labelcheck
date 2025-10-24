# Recommended GRAS Database Additions

Based on testing 50 common preservatives, additives, and enzymes, the following ingredients are currently matching via **fuzzy matching** (lower confidence) and should be added as dedicated database entries for exact matching.

## Status: 100% Match Rate, 40% Fuzzy (Should be Exact)

### ✅ HIGH PRIORITY - Common Ingredients with Incorrect Fuzzy Matches

#### Preservatives & Leavening Agents
1. **Calcium Propionate** (E282)
   - Current match: "Sodium Propionate" (WRONG - different salt form)
   - Common name: Bread preservative, mold inhibitor
   - GRAS status: Affirmed
   - Synonyms: calcium propanoate, E282

2. **Potassium Nitrate** (E252)
   - Current match: "Sodium Nitrate" (WRONG - different salt form)
   - Common name: Saltpeter, curing salt
   - GRAS status: Affirmed
   - Synonyms: E252, saltpeter

3. **Ammonium Bicarbonate**
   - Current match: "Ammonium phosphatide" (WRONG - completely different chemical)
   - Common name: Baking powder, leavening agent
   - GRAS status: Affirmed
   - Synonyms: E503, hartshorn, ammonium hydrogen carbonate

4. **Potassium Bicarbonate**
   - Current match: "Potassium" (TOO VAGUE)
   - Common name: Baking powder component
   - GRAS status: Affirmed
   - Synonyms: E501, potassium hydrogen carbonate

5. **Sodium Acid Pyrophosphate** (SAPP)
   - Current match: "Calcium acid pyrophosphate" (WRONG - different salt)
   - Common name: Leavening agent, emulsifier
   - GRAS status: Affirmed
   - Synonyms: SAPP, E450, disodium dihydrogen pyrophosphate

6. **Dipotassium Phosphate**
   - Current match: "Disodium Phosphate" (WRONG - different salt)
   - Common name: Buffer, emulsifier
   - GRAS status: Affirmed
   - Synonyms: E340, potassium phosphate dibasic

#### Emulsifiers & Stabilizers
7. **Calcium Stearate**
   - Current match: "Magnesium Stearate" (WRONG - different mineral)
   - Common name: Anticaking agent, emulsifier
   - GRAS status: Affirmed
   - Synonyms: E470, calcium octadecanoate

8. **Sodium Carboxymethylcellulose** (CMC)
   - Current match: "Sodium Benzoate" (WRONG - completely different)
   - Common name: Cellulose gum, thickener
   - GRAS status: Affirmed
   - Synonyms: CMC, E466, cellulose gum, sodium CMC

9. **Cellulose Gum**
   - Current match: "Cellulose" (PARTIAL - not specific enough)
   - Common name: CMC, thickener
   - GRAS status: Affirmed
   - Synonyms: carboxymethylcellulose, CMC, E466

#### Proteins
10. **Whey Protein Isolate**
    - Current match: "Soy Protein Isolate" (WRONG - different protein source)
    - Common name: Milk protein concentrate
    - GRAS status: Affirmed
    - Synonyms: WPI, whey isolate

11. **Pea Protein Concentrate**
    - Current match: "Canola concentrate" (WRONG - different source)
    - Common name: Plant-based protein
    - GRAS status: Affirmed
    - Synonyms: pea protein, pisum sativum protein

#### Minerals
12. **Calcium Sulfate**
    - Current match: "Chondroitin sulfate sodium" (WRONG - completely different)
    - Common name: Gypsum, firming agent, tofu coagulant
    - GRAS status: Affirmed
    - Synonyms: E516, gypsum, plaster of paris

13. **Ammonium Chloride**
    - Current match: "Calcium Chloride" (WRONG - different cation)
    - Common name: Yeast nutrient, dough conditioner
    - GRAS status: Affirmed
    - Synonyms: E510, sal ammoniac

### 🔶 MEDIUM PRIORITY - Enzyme Specific Forms

Current fuzzy matches are technically correct (matching base enzyme names) but lack specificity:

14. **Protease Enzyme** (generic)
    - Add as separate entry with common sources
    - Synonyms: proteinase, proteolytic enzyme

15. **Amylase Enzyme** (generic)
    - Add as separate entry with common sources
    - Synonyms: alpha-amylase, starch enzyme

16. **Lipase Enzyme** (generic)
    - Add as separate entry with common sources
    - Synonyms: fat enzyme, triacylglycerol lipase

17. **Glucose Oxidase** (generic)
    - Current match: "Glucose oxidase from Penicillium produced in Trichoderma reesei" (TOO SPECIFIC)
    - Add generic entry with multiple sources

18. **Invertase** (generic)
    - Current match: "Invertase enzyme preparation produced by..." (TOO SPECIFIC)
    - Add generic entry

19. **Lactase** (generic)
    - Current match: "Lactase enzyme preparation from Aspergillus niger" (TOO SPECIFIC)
    - Add generic entry

### 🔷 LOW PRIORITY - Specialty Ingredients

20. **Enzyme-Modified Lecithin**
    - Current match: "Lecithin" (PARTIAL - missing "enzyme-modified")
    - Less common, current match is acceptable

## Implementation Script Template

```javascript
const PRIORITY_ADDITIONS = [
  {
    ingredient_name: 'Calcium Propionate',
    common_name: 'Bread Preservative',
    synonyms: ['calcium propanoate', 'E282', 'calcium propionate'],
    gras_status: 'affirmed',
    is_active: true
  },
  {
    ingredient_name: 'Potassium Nitrate',
    common_name: 'Curing Salt',
    synonyms: ['saltpeter', 'E252', 'potassium nitrate'],
    gras_status: 'affirmed',
    is_active: true
  },
  // ... add remaining 11 high-priority ingredients
];
```

## Expected Impact

**Current Performance:**
- Match rate: 100% (50/50)
- High confidence (exact + synonym): 60% (30/50)
- Low confidence (fuzzy): 40% (20/50)

**After Adding 13 High-Priority Ingredients:**
- Match rate: 100% (50/50)
- High confidence (exact + synonym): 86% (43/50)
- Low confidence (fuzzy): 14% (7/50 - only generic enzymes)

**After Adding All 20 Recommended Ingredients:**
- Match rate: 100% (50/50)
- High confidence (exact + synonym): 100% (50/50)
- Low confidence (fuzzy): 0%

## Next Steps

1. **Immediate**: Add 13 high-priority ingredients (preservatives, emulsifiers, proteins, minerals)
2. **Soon**: Add 6 generic enzyme entries for common enzyme forms
3. **Optional**: Add enzyme-modified lecithin entry

This will eliminate all false positive fuzzy matches and provide maximum confidence in GRAS compliance reporting.
