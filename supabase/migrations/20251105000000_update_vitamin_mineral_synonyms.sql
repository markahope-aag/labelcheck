-- Update GRAS ingredients table with comprehensive vitamin and mineral synonym coverage
-- This migration adds missing vitamin and mineral forms commonly found in fortified foods
-- Date: 2025-11-05

-- Update Vitamin B12 with all bioavailable forms
UPDATE gras_ingredients
SET synonyms = ARRAY['cobalamin', 'cyanocobalamin', 'methylcobalamin', 'adenosylcobalamin', 'hydroxocobalamin', 'vitamin b-12']
WHERE ingredient_name = 'Vitamin B12';

-- Update Pantothenic Acid (B5) with additional forms
UPDATE gras_ingredients
SET synonyms = ARRAY['vitamin B5', 'calcium pantothenate', 'd-calcium pantothenate', 'pantothenate']
WHERE ingredient_name = 'Pantothenic Acid';

-- Add Thiamin (Vitamin B1)
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Thiamin',
    'affirmed',
    '21 CFR 184.1875',
    'nutrient',
    ARRAY['vitamin B1', 'thiamine', 'thiamine hydrochloride', 'thiamine mononitrate', 'thiamin hcl'],
    'Vitamin B1'
) ON CONFLICT DO NOTHING;

-- Add Riboflavin (Vitamin B2)
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Riboflavin',
    'affirmed',
    '21 CFR 184.1763',
    'nutrient',
    ARRAY['vitamin B2', 'riboflavin 5''-phosphate', 'riboflavin-5-phosphate sodium'],
    'Vitamin B2'
) ON CONFLICT DO NOTHING;

-- Add Niacin (Vitamin B3)
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Niacin',
    'affirmed',
    '21 CFR 184.1535',
    'nutrient',
    ARRAY['vitamin B3', 'niacinamide', 'nicotinamide', 'nicotinic acid'],
    'Vitamin B3'
) ON CONFLICT DO NOTHING;

-- Add Pyridoxine (Vitamin B6)
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Pyridoxine',
    'affirmed',
    '21 CFR 184.1676',
    'nutrient',
    ARRAY['vitamin B6', 'pyridoxine hydrochloride', 'pyridoxine hcl', 'pyridoxal', 'pyridoxal-5-phosphate', 'p-5-p', 'pyridoxal 5''-phosphate'],
    'Vitamin B6'
) ON CONFLICT DO NOTHING;

-- Add Ascorbic Acid (Vitamin C) - update if exists, insert if not
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Ascorbic Acid',
    'affirmed',
    '21 CFR 182.3013',
    'nutrient',
    ARRAY['vitamin C', 'ascorbate', 'sodium ascorbate', 'calcium ascorbate', 'l-ascorbic acid'],
    'Vitamin C'
) ON CONFLICT (ingredient_name) DO UPDATE
SET synonyms = EXCLUDED.synonyms;

-- Add Vitamin E
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name)
VALUES (
    'Vitamin E',
    'affirmed',
    '21 CFR 182.5892',
    'nutrient',
    ARRAY['tocopherol', 'd-alpha tocopherol', 'dl-alpha tocopherol', 'tocopheryl acetate', 'd-alpha tocopheryl acetate', 'mixed tocopherols', 'tocotrienols'],
    'Vitamin E'
) ON CONFLICT DO NOTHING;

-- Update Calcium with comprehensive forms
UPDATE gras_ingredients
SET synonyms = ARRAY['calcium supplement', 'elemental calcium', 'calcium carbonate', 'calcium citrate', 'calcium gluconate', 'calcium lactate', 'tricalcium phosphate', 'dicalcium phosphate']
WHERE ingredient_name = 'Calcium';

-- Update Iron with comprehensive forms
UPDATE gras_ingredients
SET synonyms = ARRAY['ferrous sulfate', 'ferrous fumarate', 'ferric orthophosphate', 'ferrous gluconate', 'ferric pyrophosphate', 'carbonyl iron', 'elemental iron']
WHERE ingredient_name = 'Iron';

-- Update Magnesium with comprehensive forms
UPDATE gras_ingredients
SET synonyms = ARRAY['magnesium oxide', 'magnesium citrate', 'magnesium glycinate', 'magnesium gluconate', 'magnesium chloride', 'magnesium sulfate', 'magnesium malate', 'elemental magnesium']
WHERE ingredient_name = 'Magnesium';

-- Update Potassium with comprehensive forms
UPDATE gras_ingredients
SET synonyms = ARRAY['potassium supplement', 'potassium chloride', 'potassium citrate', 'potassium gluconate', 'elemental potassium']
WHERE ingredient_name = 'Potassium';

-- Add comment documenting this update
COMMENT ON TABLE gras_ingredients IS 'FDA Generally Recognized as Safe (GRAS) ingredients database. Updated 2025-11-05 with comprehensive vitamin/mineral synonyms for fortified food products.';
