-- Create GRAS (Generally Recognized as Safe) ingredients table
-- This table contains FDA-approved ingredients for food products

CREATE TABLE IF NOT EXISTS gras_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_name TEXT NOT NULL,
    cas_number TEXT, -- Chemical Abstracts Service registry number
    gras_notice_number TEXT, -- FDA GRAS Notice number (e.g., "GRN 000123")
    gras_status TEXT NOT NULL CHECK (gras_status IN ('affirmed', 'notice', 'scogs', 'pending')),
    source_reference TEXT, -- CFR citation or SCOGS reference
    category TEXT, -- e.g., "preservative", "flavor", "colorant", "emulsifier"
    approved_uses TEXT[], -- Array of approved food applications
    limitations TEXT, -- Usage limitations or conditions
    synonyms TEXT[], -- Alternative names for ingredient matching
    common_name TEXT, -- Common/trade name if different from ingredient_name
    technical_name TEXT, -- IUPAC or technical chemical name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_gras_ingredient_name ON gras_ingredients (ingredient_name);
CREATE INDEX IF NOT EXISTS idx_gras_cas_number ON gras_ingredients (cas_number) WHERE cas_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_notice_number ON gras_ingredients (gras_notice_number) WHERE gras_notice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_status ON gras_ingredients (gras_status);
CREATE INDEX IF NOT EXISTS idx_gras_category ON gras_ingredients (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_active ON gras_ingredients (is_active) WHERE is_active = true;

-- Index for array search on synonyms (GIN index for JSONB array searching)
CREATE INDEX IF NOT EXISTS idx_gras_synonyms ON gras_ingredients USING gin(synonyms);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_gras_ingredients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gras_ingredients_updated_at
    BEFORE UPDATE ON gras_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_gras_ingredients_updated_at();

-- Add comments for documentation
COMMENT ON TABLE gras_ingredients IS 'FDA Generally Recognized as Safe (GRAS) ingredients database for food product compliance checking';
COMMENT ON COLUMN gras_ingredients.ingredient_name IS 'Primary name of the ingredient';
COMMENT ON COLUMN gras_ingredients.cas_number IS 'Chemical Abstracts Service registry number for unique identification';
COMMENT ON COLUMN gras_ingredients.gras_notice_number IS 'FDA GRAS Notice number (e.g., GRN 000123)';
COMMENT ON COLUMN gras_ingredients.gras_status IS 'GRAS determination type: affirmed (CFR listed), notice (FDA reviewed notification), scogs (SCOGS database), pending (under review)';
COMMENT ON COLUMN gras_ingredients.source_reference IS 'Citation to CFR regulation, SCOGS report, or GRAS notice';
COMMENT ON COLUMN gras_ingredients.category IS 'Functional category (preservative, flavor, colorant, etc.)';
COMMENT ON COLUMN gras_ingredients.approved_uses IS 'Array of approved food applications or use cases';
COMMENT ON COLUMN gras_ingredients.limitations IS 'Usage limitations, maximum levels, or specific conditions';
COMMENT ON COLUMN gras_ingredients.synonyms IS 'Alternative names for ingredient matching (e.g., "ascorbic acid" synonym for "vitamin C")';

-- Insert some common GRAS ingredients as seed data
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms) VALUES
('Water', 'affirmed', '21 CFR 184.1', 'solvent', ARRAY['H2O', 'purified water', 'distilled water']),
('Salt', 'affirmed', '21 CFR 184.1634', 'seasoning', ARRAY['sodium chloride', 'NaCl', 'table salt']),
('Sugar', 'affirmed', '21 CFR 184.1854', 'sweetener', ARRAY['sucrose', 'cane sugar', 'beet sugar']),
('Citric Acid', 'affirmed', '21 CFR 184.1033', 'acidulant', ARRAY['E330']),
('Ascorbic Acid', 'affirmed', '21 CFR 184.1073', 'antioxidant', ARRAY['vitamin C', 'E300']),
('Acetic Acid', 'affirmed', '21 CFR 184.1005', 'acidulant', ARRAY['vinegar', 'E260']),
('Lecithin', 'affirmed', '21 CFR 184.1400', 'emulsifier', ARRAY['soy lecithin', 'E322']),
('Caffeine', 'affirmed', '21 CFR 182.1180', 'stimulant', ARRAY['1,3,7-trimethylxanthine']),
('Vanilla Extract', 'affirmed', '21 CFR 169.175', 'flavor', ARRAY['vanilla', 'vanilla flavoring']),
('Potassium Sorbate', 'affirmed', '21 CFR 182.3640', 'preservative', ARRAY['E202']),
('Sodium Benzoate', 'affirmed', '21 CFR 184.1733', 'preservative', ARRAY['E211']),
('Calcium Carbonate', 'affirmed', '21 CFR 184.1191', 'nutrient', ARRAY['E170', 'limestone']),
('Gelatin', 'affirmed', '21 CFR 184.1560', 'gelling agent', ARRAY['gelatine']),
('Pectin', 'affirmed', '21 CFR 184.1588', 'gelling agent', ARRAY['E440']),
('Agar', 'affirmed', '21 CFR 184.1115', 'gelling agent', ARRAY['agar-agar', 'E406']),
('Carrageenan', 'affirmed', '21 CFR 172.620', 'thickener', ARRAY['E407']),
('Guar Gum', 'affirmed', '21 CFR 184.1339', 'thickener', ARRAY['E412']),
('Xanthan Gum', 'affirmed', '21 CFR 172.695', 'thickener', ARRAY['E415']),
('Modified Food Starch', 'affirmed', '21 CFR 172.892', 'thickener', ARRAY['modified starch']),
('Corn Starch', 'affirmed', '21 CFR 184.1655', 'thickener', ARRAY['maize starch', 'cornstarch']);

-- Grant appropriate permissions (adjust role name as needed)
-- ALTER TABLE gras_ingredients ENABLE ROW LEVEL SECURITY;
-- Note: GRAS data is public information, so we allow read access to all authenticated users
-- Only admins should be able to modify this data
