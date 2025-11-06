-- Migration: Update mineral compound synonyms in GRAS database
-- Date: 2025-11-05
-- Purpose: Add comprehensive selenium and other mineral compound forms to reduce verification warnings
-- Note: With new logic, "not found" = "requires verification" (not violation), so we can include
--       commonly-used forms (self-affirmed GRAS, approved compounds) to be more helpful

-- Update Selenium with comprehensive compound forms
-- Includes both FDA-notified GRAS (GRN 353 for selenium yeast) and self-affirmed GRAS forms
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'sodium selenite',
    'selenium yeast',
    'L-selenomethionine',
    'selenomethionine',
    'selenium methionine',
    'selenious acid',
    'sodium selenate',
    'seleno-L-methionine',
    'selenium amino acid chelate',
    'selenium proteinate',
    'high-selenium yeast',
    'selenium-enriched yeast'
  ],
  gras_status = 'notice',
  source_reference = 'GRN 353 (selenium yeast), Self-affirmed GRAS (various forms)'
WHERE ingredient_name = 'Selenium';

-- Update Zinc with comprehensive compound forms
-- CFR-listed: oxide, sulfate, gluconate | Self-affirmed: citrate, picolinate, chelated forms
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'zinc oxide',
    'zinc sulfate',
    'zinc gluconate',
    'zinc citrate',
    'zinc picolinate',
    'zinc acetate',
    'zinc monomethionine',
    'zinc amino acid chelate',
    'zinc aspartate',
    'zinc bisglycinate',
    'elemental zinc'
  ],
  source_reference = '21 CFR 182.8988 (gluconate), 21 CFR 182.8991 (oxide), 21 CFR 182.8997 (sulfate), Self-affirmed GRAS (citrate, picolinate, other chelated forms)'
WHERE ingredient_name = 'Zinc';

-- Update Copper with comprehensive compound forms
-- CFR-listed: gluconate | Self-affirmed: sulfate, oxide, citrate, chelated forms
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'copper gluconate',
    'cupric sulfate',
    'copper sulfate',
    'cupric oxide',
    'copper oxide',
    'copper citrate',
    'copper amino acid chelate',
    'copper bisglycinate',
    'cupric acetate',
    'elemental copper'
  ],
  source_reference = '21 CFR 184.1261 (gluconate), Self-affirmed GRAS (sulfate, oxide, citrate, chelated forms)'
WHERE ingredient_name = 'Copper';

-- Update Manganese with comprehensive compound forms
-- CFR-listed: sulfate, gluconate, chloride | Self-affirmed: citrate, chelated forms
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'manganese sulfate',
    'manganese gluconate',
    'manganese citrate',
    'manganese amino acid chelate',
    'manganese chloride',
    'manganese aspartate',
    'manganese bisglycinate',
    'elemental manganese'
  ],
  source_reference = '21 CFR 184.1452 (sulfate, gluconate, chloride), Self-affirmed GRAS (citrate, chelated forms)'
WHERE ingredient_name = 'Manganese';

-- Update Chromium with comprehensive compound forms
-- CFR-listed: chromic chloride | Self-affirmed: picolinate, polynicotinate, other forms
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'chromium picolinate',
    'chromium chloride',
    'chromium polynicotinate',
    'chromic chloride',
    'chromium amino acid chelate',
    'chromium GTF',
    'chromium nicotinate',
    'elemental chromium'
  ],
  source_reference = '21 CFR 172.379 (chromic chloride), Self-affirmed GRAS (picolinate, polynicotinate, other forms)'
WHERE ingredient_name = 'Chromium';

-- Update Iodine with comprehensive compound forms
-- CFR-listed: potassium iodide, potassium iodate | Self-affirmed: sodium iodide, kelp
UPDATE gras_ingredients
SET
  synonyms = ARRAY[
    'potassium iodide',
    'iodized salt',
    'sodium iodide',
    'kelp',
    'potassium iodate',
    'calcium iodide',
    'elemental iodine'
  ],
  source_reference = '21 CFR 184.1265 (potassium iodide), 21 CFR 184.1634 (potassium iodate), Self-affirmed GRAS (sodium iodide, kelp)'
WHERE ingredient_name = 'Iodine';

-- Add Molybdenum if it doesn't exist
-- Self-affirmed GRAS for various molybdenum salts
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms, common_name, is_active)
SELECT
  'Molybdenum',
  'notice',
  'Self-affirmed GRAS (various molybdenum salts)',
  'nutrient',
  ARRAY[
    'sodium molybdate',
    'molybdenum amino acid chelate',
    'molybdenum glycinate',
    'ammonium molybdate',
    'elemental molybdenum'
  ],
  'Molybdenum',
  true
WHERE NOT EXISTS (SELECT 1 FROM gras_ingredients WHERE ingredient_name = 'Molybdenum');

-- Verify updates
DO $$
DECLARE
  selenium_count INTEGER;
  zinc_count INTEGER;
  copper_count INTEGER;
  manganese_count INTEGER;
  chromium_count INTEGER;
  iodine_count INTEGER;
  molybdenum_count INTEGER;
BEGIN
  SELECT array_length(synonyms, 1) INTO selenium_count FROM gras_ingredients WHERE ingredient_name = 'Selenium';
  SELECT array_length(synonyms, 1) INTO zinc_count FROM gras_ingredients WHERE ingredient_name = 'Zinc';
  SELECT array_length(synonyms, 1) INTO copper_count FROM gras_ingredients WHERE ingredient_name = 'Copper';
  SELECT array_length(synonyms, 1) INTO manganese_count FROM gras_ingredients WHERE ingredient_name = 'Manganese';
  SELECT array_length(synonyms, 1) INTO chromium_count FROM gras_ingredients WHERE ingredient_name = 'Chromium';
  SELECT array_length(synonyms, 1) INTO iodine_count FROM gras_ingredients WHERE ingredient_name = 'Iodine';
  SELECT COUNT(*) INTO molybdenum_count FROM gras_ingredients WHERE ingredient_name = 'Molybdenum';

  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE 'Selenium: % synonyms', selenium_count;
  RAISE NOTICE 'Zinc: % synonyms', zinc_count;
  RAISE NOTICE 'Copper: % synonyms', copper_count;
  RAISE NOTICE 'Manganese: % synonyms', manganese_count;
  RAISE NOTICE 'Chromium: % synonyms', chromium_count;
  RAISE NOTICE 'Iodine: % synonyms', iodine_count;
  RAISE NOTICE 'Molybdenum exists: %', molybdenum_count > 0;
END $$;
