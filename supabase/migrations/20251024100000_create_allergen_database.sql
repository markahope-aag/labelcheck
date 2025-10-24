-- Create major allergens database table
-- Stores the 9 FDA-recognized major food allergens (FALCPA/FASTER Act) with comprehensive synonyms and derivatives

CREATE TABLE IF NOT EXISTS major_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allergen_name TEXT NOT NULL UNIQUE,
  allergen_category TEXT NOT NULL, -- 'milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'sesame'
  common_name TEXT,
  derivatives TEXT[] NOT NULL DEFAULT '{}', -- Array of known derivatives and synonyms
  scientific_names TEXT[] DEFAULT '{}', -- Scientific/chemical names
  cross_reactive_allergens TEXT[] DEFAULT '{}', -- Related allergens that may cause cross-reactions
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  regulation_citation TEXT DEFAULT 'FALCPA Section 403(w), FASTER Act',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_allergens_category ON major_allergens(allergen_category);
CREATE INDEX IF NOT EXISTS idx_allergens_active ON major_allergens(is_active);
CREATE INDEX IF NOT EXISTS idx_allergens_name ON major_allergens(allergen_name);

-- Enable Row Level Security
ALTER TABLE major_allergens ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can check allergens)
CREATE POLICY "Allow public read access to allergens"
  ON major_allergens
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create policy for authenticated users to read all allergens
CREATE POLICY "Allow authenticated read access to all allergens"
  ON major_allergens
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert the 9 major food allergens with comprehensive derivatives

-- 1. MILK
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Milk',
  'milk',
  'Dairy',
  ARRAY[
    'casein', 'caseinate', 'whey', 'lactalbumin', 'lactoglobulin', 'lactose',
    'butter', 'cream', 'cheese', 'ghee', 'yogurt', 'curds', 'milk powder',
    'artificial butter flavor', 'caramel color', 'milk solids', 'nonfat milk',
    'skim milk', 'whole milk', 'evaporated milk', 'condensed milk', 'buttermilk',
    'half and half', 'sour cream', 'milk protein', 'milk fat', 'sodium caseinate',
    'calcium caseinate', 'potassium caseinate', 'hydrolyzed casein', 'rennet casein',
    'whey protein', 'whey protein concentrate', 'whey protein isolate', 'lactulose',
    'tagatose', 'recaldent', 'simplesse', 'lactitol', 'lactyc esters of fatty acids'
  ],
  ARRAY['Lactose', 'Casein', 'Whey protein', 'Alpha-lactalbumin', 'Beta-lactoglobulin'],
  'Most common food allergen. Derivatives can be hidden in many processed foods.'
);

-- 2. EGGS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Eggs',
  'egg',
  'Eggs',
  ARRAY[
    'albumin', 'ovalbumin', 'globulin', 'lecithin', 'livetin', 'lysozyme',
    'ovoglobulin', 'ovomucoid', 'ovomucin', 'ovovitellin', 'egg white', 'egg yolk',
    'dried egg solids', 'mayonnaise', 'meringue', 'egg powder', 'egg substitute',
    'egg protein', 'whole egg', 'egg albumin', 'egg lecithin', 'dried egg',
    'powdered egg', 'eggnog', 'surimi', 'simplesse', 'ovoglycoprotein',
    'livetins', 'vitellin', 'apovitellin', 'phosvitin', 'silici albuminate'
  ],
  ARRAY['Ovalbumin', 'Ovomucoid', 'Ovotransferrin', 'Lysozyme', 'Ovomucin'],
  'Eggs are used as binders, leavening agents, and emulsifiers in many foods.'
);

-- 3. FISH
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Fish',
  'fish',
  'Finned Fish',
  ARRAY[
    'anchovy', 'bass', 'catfish', 'cod', 'flounder', 'haddock', 'hake', 'perch',
    'pike', 'pollock', 'salmon', 'sole', 'snapper', 'tilapia', 'tuna', 'trout',
    'fish gelatin', 'fish oil', 'surimi', 'isinglass', 'fish sauce', 'fish stock',
    'fish flavoring', 'worcestershire sauce', 'caesar dressing', 'anchovies',
    'bouillabaisse', 'caponata', 'caviar', 'roe', 'fish protein', 'dashi',
    'halibut', 'herring', 'mackerel', 'mahi mahi', 'marlin', 'orange roughy',
    'swordfish', 'shark', 'grouper', 'monkfish', 'sea bass'
  ],
  ARRAY['Parvalbumin', 'Fish collagen', 'Fish gelatin'],
  'Includes all finned fish species. Cross-contamination is common in seafood facilities.'
);

-- 4. CRUSTACEAN SHELLFISH
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Crustacean Shellfish',
  'shellfish',
  'Shellfish',
  ARRAY[
    'crab', 'lobster', 'shrimp', 'prawn', 'crayfish', 'krill', 'langoustine',
    'shellfish extract', 'shellfish flavoring', 'chitosan', 'glucosamine',
    'crawfish', 'crawdad', 'ecrevisse', 'scampi', 'tomalley', 'crab paste',
    'shrimp paste', 'barnacle', 'langouste', 'langostino', 'moreton bay bugs',
    'scampi', 'yabbies', 'shrimp powder', 'crab oil', 'lobster oil',
    'shellfish stock', 'crab stock', 'shrimp stock'
  ],
  ARRAY['Tropomyosin', 'Arginine kinase', 'Myosin light chain'],
  'Does not include mollusks (clams, oysters, scallops) which are not major allergens under FALCPA.'
);

-- 5. TREE NUTS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Tree Nuts',
  'tree_nuts',
  'Tree Nuts',
  ARRAY[
    'almond', 'brazil nut', 'cashew', 'chestnut', 'filbert', 'hazelnut',
    'hickory nut', 'macadamia nut', 'pecan', 'pine nut', 'pignolia', 'pistachio',
    'walnut', 'nut butters', 'nut oils', 'praline', 'marzipan', 'nougat',
    'gianduja', 'nut paste', 'nut flour', 'nut meal', 'nut milk', 'almond milk',
    'cashew milk', 'beechnut', 'butternut', 'chinquapin', 'coconut', 'ginkgo nut',
    'shea nut', 'litchi', 'lychee', 'mandelonas', 'natural nut extract',
    'nut flavoring', 'queensland nut', 'amaretto', 'frangelico', 'nocello',
    'nutella', 'nut oil', 'almond extract', 'almond oil', 'walnut oil',
    'hazelnut oil', 'macadamia oil', 'pistachio oil'
  ],
  ARRAY['Ara h 1', 'Ara h 2', 'Ara h 3', 'Cor a 1', 'Jug r 1'],
  'Each tree nut type is considered a separate allergen, but FDA requires declaration of specific nut type.'
);

-- 6. PEANUTS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Peanuts',
  'peanuts',
  'Groundnuts',
  ARRAY[
    'groundnuts', 'peanut flour', 'peanut oil', 'peanut butter', 'arachis oil',
    'hydrolyzed plant protein', 'artificial nuts', 'peanut meal', 'peanut protein isolate',
    'peanut protein', 'beer nuts', 'goober peas', 'ground nuts', 'mandelonas',
    'monkey nuts', 'nut meat', 'nu-nuts', 'peanut paste', 'peanut sauce',
    'peanut syrup', 'cold pressed peanut oil', 'extruded peanut oil',
    'goobers', 'arachis hypogaea', 'peanut extract', 'peanut flavoring',
    'mixed nuts', 'trail mix', 'satay sauce', 'pad thai', 'mole sauce'
  ],
  ARRAY['Ara h 1', 'Ara h 2', 'Ara h 3', 'Ara h 6', 'Arachis hypogaea'],
  'Peanuts are legumes, not true nuts. Highly refined peanut oil is generally exempt from labeling.'
);

-- 7. WHEAT
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Wheat',
  'wheat',
  'Wheat',
  ARRAY[
    'bran', 'bread crumbs', 'bulgur', 'couscous', 'durum', 'einkorn', 'emmer',
    'farina', 'farro', 'flour', 'gluten', 'hydrolyzed wheat protein', 'kamut',
    'malt', 'semolina', 'seitan', 'spelt', 'vital wheat gluten', 'wheat germ',
    'modified food starch', 'wheat protein', 'wheat starch', 'wheat flour',
    'all purpose flour', 'enriched flour', 'graham flour', 'whole wheat',
    'wheat berries', 'wheat grass', 'wheat grass juice', 'triticale', 'fu',
    'matzo', 'matzah', 'matzoh', 'panko', 'wheat bran', 'wheat gluten',
    'wheat malt', 'wheat protein isolate', 'bromated flour', 'club wheat',
    'common wheat', 'sprouted wheat', 'wheat triticum', 'wheat albumin',
    'wheat gliadin', 'wheat globulin', 'wheat starch', 'udon'
  ],
  ARRAY['Gliadin', 'Glutenin', 'Wheat albumin', 'Triticum aestivum'],
  'Gluten-free does not mean wheat-free. Different from celiac disease (gluten intolerance).'
);

-- 8. SOYBEANS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Soybeans',
  'soybeans',
  'Soy',
  ARRAY[
    'edamame', 'miso', 'natto', 'shoyu', 'soy flour', 'soy protein concentrate',
    'soy protein isolate', 'soy lecithin', 'soy oil', 'soy milk', 'tempeh',
    'textured vegetable protein', 'tofu', 'hydrolyzed soy protein', 'msg',
    'soy sauce', 'soy protein', 'soy albumin', 'soy fiber', 'soy grits',
    'soy nuts', 'soybean oil', 'soybean paste', 'tamari', 'teriyaki sauce',
    'hydrolyzed vegetable protein', 'TVP', 'textured soy protein', 'soya',
    'soya flour', 'bean curd', 'kinako', 'kyodofu', 'yuba', 'okara',
    'soy isoflavones', 'soy mono and diglycerides', 'soy sprouts', 'yaki-dofu',
    'glycine max', 'monosodium glutamate', 'vegetable gum', 'vegetable starch'
  ],
  ARRAY['Glycinin', 'Beta-conglycinin', 'Glycine max', 'Soy albumin'],
  'Highly refined soy oil and soy lecithin are generally exempt. MSG may be soy-derived.'
);

-- 9. SESAME
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Sesame',
  'sesame',
  'Sesame Seeds',
  ARRAY[
    'sesame seeds', 'sesame oil', 'tahini', 'gingelly oil', 'benne', 'benne seed',
    'til', 'sesame flour', 'sesame protein isolate', 'sesame paste', 'sesame salt',
    'sesamol', 'sesamum indicum', 'sesamolina', 'sim sim', 'gomasio', 'gomashio',
    'halvah', 'halva', 'halawa', 'hummus', 'baba ghanoush', 'sesame butter',
    'sesame sticks', 'sesame crackers', 'sesame seed oil', 'toasted sesame oil',
    'black sesame', 'white sesame', 'hulled sesame', 'unhulled sesame'
  ],
  ARRAY['Sesamum indicum', 'Ses i 1', 'Ses i 2', 'Ses i 3'],
  'Added as 9th major allergen by FASTER Act, effective January 1, 2023. Previously voluntary.'
);

-- Add comments to table
COMMENT ON TABLE major_allergens IS 'FDA-recognized major food allergens per FALCPA/FASTER Act with comprehensive derivatives and synonyms';
COMMENT ON COLUMN major_allergens.allergen_name IS 'Official FDA allergen name';
COMMENT ON COLUMN major_allergens.allergen_category IS 'Normalized category slug for grouping';
COMMENT ON COLUMN major_allergens.derivatives IS 'Array of known derivatives, synonyms, and ingredient names containing this allergen';
COMMENT ON COLUMN major_allergens.scientific_names IS 'Scientific/chemical names and protein markers';
COMMENT ON COLUMN major_allergens.regulation_citation IS 'Regulatory reference (FALCPA/FASTER Act)';
