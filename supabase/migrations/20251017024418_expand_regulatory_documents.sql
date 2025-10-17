-- Expand Regulatory Documents Database
-- 
-- This migration expands the regulatory documents database with comprehensive FDA, USDA, 
-- and international food labeling regulations. Adds detailed requirements across all 
-- major categories including nutrition, allergens, claims, organic standards, and more.

-- Insert expanded regulatory documents
INSERT INTO regulatory_documents (
  title,
  description,
  content,
  document_type,
  jurisdiction,
  source,
  effective_date,
  version,
  is_active
) VALUES
(
  'Health and Nutrient Content Claims',
  'FDA regulations for health claims and nutrient content claims on food labels',
  'Nutrient content claims must meet specific criteria: "Low fat" means 3g or less per serving. "Reduced" means 25% less than reference food. "Light" means 50% less fat or 1/3 fewer calories. "Good source" means 10-19% DV per serving. "High" or "Excellent source" means 20% or more DV. Health claims linking nutrients to disease risk must be pre-approved by FDA or based on authoritative statements. Qualified health claims require specific FDA-approved wording and may include disclaimers about limited scientific evidence.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.13, 101.54, 101.56',
  '2016-07-26',
  '2016',
  true
),
(
  'Trans Fat Labeling Requirements',
  'FDA requirements for trans fat declaration on nutrition labels',
  'Trans fat must be listed on a separate line under saturated fat in the nutrition facts panel. Amount must be declared to nearest 0.5g for amounts above 0.5g per serving. If trans fat is less than 0.5g per serving, it may be listed as 0g, but a footnote stating "Not a significant source of trans fat" is encouraged. Products claiming "0g trans fat" must contain less than 0.5g per serving AND less than 0.5g saturated fat per serving. Partially hydrogenated oils (PHOs) are banned as of 2020 except for specific authorized uses.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9',
  '2020-01-01',
  '2020',
  true
),
(
  'Added Sugars Labeling',
  'FDA requirements for declaring added sugars on nutrition labels',
  'Added sugars must be listed in grams and as a percent Daily Value (%DV) based on 50g per day (10% of a 2000 calorie diet). Added sugars include sugars added during processing or packaging, plus sugars from syrups, honey, and concentrated fruit/vegetable juices. The label must state "Includes Xg Added Sugars" indented under Total Sugars. A %DV must be included. This applies to single-ingredient sugars like honey and maple syrup with labels. Products with less than 1g of total sugars and no added sugar ingredients are exempt.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9',
  '2021-01-01',
  '2021',
  true
),
(
  'Serving Size Determination',
  'FDA Reference Amounts Customarily Consumed (RACC) for determining serving sizes',
  'Serving sizes must be based on FDA Reference Amounts Customarily Consumed (RACC), not manufacturer preference. RACC reflects amounts typically eaten in one sitting based on FDA surveys. If package contains between 150% and 200% of RACC, entire package is one serving. Packages with 200-400% of RACC should declare as 2 servings. Products consumed in one eating occasion regardless of size must be labeled as one serving if package is between 1-2 servings. Dual-column labels required for certain multi-serving packages. Serving sizes must be declared in common household measures (cups, pieces) with metric equivalents.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9, 101.12',
  '2018-07-26',
  '2018',
  true
),
(
  'USDA Organic Labeling Standards',
  'USDA National Organic Program requirements for organic product labeling',
  'Products labeled "100% Organic" must contain only organically produced ingredients (excluding water and salt). Products labeled "Organic" must contain at least 95% organically produced ingredients. Products labeled "Made with Organic [ingredients]" must contain at least 70% organic ingredients. All organic products must display the USDA Organic seal if they meet requirements. Products must be certified by USDA-accredited certifying agent. Prohibited substances cannot be used. Organic livestock must have access to outdoors and organic feed. GMOs are prohibited in organic production. Detailed production and handling records required.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 205',
  '2002-10-21',
  '2024',
  true
),
(
  'Gluten-Free Labeling Standards',
  'FDA standards for gluten-free claims on food products',
  'Foods labeled "gluten-free," "no gluten," "free of gluten," or "without gluten" must contain less than 20 parts per million (ppm) of gluten. This applies to inherently gluten-free foods and those made gluten-free. Products cannot contain wheat, rye, barley, or crossbreeds of these grains unless the ingredient has been processed to remove gluten below 20 ppm. Oats may be used if specially produced to be gluten-free. Manufacturers responsible for ensuring compliance through testing or supplier guarantees. Claims apply to both packaged foods and restaurant foods.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.91',
  '2014-08-05',
  '2014',
  true
),
(
  'Bioengineered Food Disclosure',
  'USDA requirements for GMO disclosure on food products',
  'Foods containing bioengineered ingredients (GMOs) must disclose this information. Disclosure required if food contains more than 5% bioengineered material by weight. Acceptable disclosure methods: text statement "bioengineered food" or "contains a bioengineered food ingredient," USDA bioengineered food symbol, electronic/digital link (QR code), or text message option. Small food manufacturers (less than $2.5M annual receipts) may use phone number or website. Very small packages may use abbreviated disclosure. Disclosure must be on information panel or principal display panel. Highly refined ingredients where genetic material is undetectable are exempt.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 66',
  '2022-01-01',
  '2022',
  true
),
(
  'Country of Origin Labeling (COOL)',
  'USDA requirements for country of origin declarations',
  'Country of origin required for: fresh fruits and vegetables, fish and shellfish, peanuts, pecans, macadamia nuts, and ginseng. Must state production origin: "Product of [country name]" or "Grown in [country name]." For processed foods, country of origin disclosure is voluntary but must be truthful if declared. "Made in USA" claims require final article be manufactured or significantly transformed in US, and all or virtually all ingredients/components must be US-origin. Imported products must declare country of origin conspicuously on label. Retailer responsible for maintaining country of origin information. False origin statements subject to penalties.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 60, FTC Act',
  '2009-03-16',
  '2023',
  true
),
(
  'Net Quantity of Contents',
  'FDA and FTC requirements for net quantity declarations on packages',
  'Net quantity statement required on principal display panel. Must be in US customary (ounces, pounds) and metric (grams, kilograms) units. Statement must appear in lower 30% of principal display panel. Type size requirements based on package size: 1/16 inch for panels 5 sq in or less, up to 1/2 inch for panels over 100 sq in. Quantity must include only contents, not packaging. For liquids, use fluid ounces. For solids, use weight. Count may be included for discrete units. "Net Wt" or "Net Weight" abbreviation acceptable. Bidirectional languages require special placement rules.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.105, FTC 16 CFR 500',
  '1994-01-01',
  '2020',
  true
),
(
  'Date Labeling Guidelines',
  'FDA guidance on use of date labels like Best By and Use By',
  'Date labeling not federally required except for infant formula. Manufacturers may voluntarily include dates. "Best if Used By" indicates peak quality, not safety. "Use By" indicates last recommended date for use at peak quality. "Sell By" is for retailer inventory management. Dates should not be used as safety indicator for most foods. Consumers can use food beyond these dates if no spoilage signs present. Dates must be month/day or month/year format with explanation phrase. Infant formula "Use By" date is mandatory and indicates date by which product should be consumed for safety and nutritional quality.',
  'guideline',
  'United States',
  'FDA Guidance',
  '2019-05-23',
  '2019',
  true
),
(
  'Caffeine Disclosure Requirements',
  'FDA requirements for caffeine content warnings and disclosure',
  'Caffeine must be listed in ingredient list. Products with added caffeine (beyond naturally occurring) should declare total caffeine content per serving. Energy drinks and dietary supplements with caffeine should include warning statement: "This product contains caffeine." For products marketed with caffeine claims, actual content should be declared. FDA has not set specific caffeine level limits for foods but monitors levels. Products marketed as dietary supplements must follow supplement labeling rules. Extremely high caffeine products may require special warnings. Caffeine content claims must be truthful and not misleading.',
  'guideline',
  'United States',
  'FDA 21 CFR 101.4, Guidance',
  '2015-01-01',
  '2023',
  true
),
(
  'Juice Content Declaration',
  'FDA requirements for declaring juice percentage in beverages',
  'Beverages containing juice must declare percentage of juice on information panel. Declaration must state "Contains X% [name of juice]" or "X% Juice." For 100% juice, can use "100% Juice" or "All Juice." For juice blends, must declare each juice type and percentage or total juice percentage. Juice declaration must be near most prominent juice characterization. Minimum type size 6 points. Juice from concentrate must be declared. Products with no juice may state "Contains No Juice" or "No Juice." Diluted juice products must indicate dilution. Claims about juice content (e.g., "made with real fruit juice") require minimum juice threshold.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.30',
  '1994-01-01',
  '2018',
  true
),
(
  'Whole Grain Content Claims',
  'FDA guidance on making whole grain claims on food labels',
  'Whole grain claims should identify specific grain (e.g., "whole wheat"). Products claiming "good source of whole grain" should provide at least 8g of whole grain per serving. "Excellent source" requires 16g per serving. 51% or more of grain ingredients should be whole grain to make unqualified whole grain claims. Whole grain stamp programs are voluntary industry initiatives, not FDA-regulated. "Made with whole grains" is acceptable if product contains whole grain, but percentage should be clear. "100% whole grain" means all grain ingredients are whole grain. Refined grains cannot be characterized as whole grain. Whole grain content may be declared in grams on nutrition label.',
  'guideline',
  'United States',
  'FDA Draft Guidance',
  '2006-02-01',
  '2023',
  true
),
(
  'Natural Food Labeling Policy',
  'FDA policy on use of natural claims on food products',
  'FDA has not established formal definition of "natural" but has policy that nothing artificial or synthetic (including artificial flavors, colors, or chemical preservatives) should be in product labeled "natural." Policy only addresses added ingredients, not production methods. "Natural" does not mean organic or address animal welfare, environmental or pesticide use. USDA has definition for meat and poultry: minimally processed with no artificial ingredients. "All natural" should mean product contains only natural ingredients. GMO ingredients do not automatically disqualify "natural" claim under current FDA policy. Natural claims are subject to FTC truth-in-advertising requirements.',
  'policy',
  'United States',
  'FDA Policy, USDA FSIS',
  '1991-01-01',
  '2023',
  true
),
(
  'Front-of-Package Labeling',
  'Requirements and guidance for nutrition and health information on front panels',
  'Front-of-package claims must not be false or misleading. Nutrient content claims on front must meet regulatory definitions. If front panel makes claim about one nutrient, cannot omit information about nutrients to limit (fat, sodium, cholesterol). Principal display panel must include product identity, net quantity, and any required warnings. Voluntary front-of-pack nutrition symbols must be truthful and not misleading. Claims must be substantiated and not contradict information on nutrition facts panel. Images showing serving suggestions must be clearly labeled as such. Size of claims proportional to package size. Third-party seals and certifications permitted if truthful and substantiated.',
  'guideline',
  'United States',
  'FDA 21 CFR 101, FTC Act',
  '2014-01-01',
  '2022',
  true
),
(
  'Foods Marketed to Children',
  'Special labeling considerations for foods marketed to children',
  'All standard labeling rules apply. Products using child-appealing features (cartoon characters, games, bright colors) should meet responsible nutrition standards. Marketing on packages must not be deceptive about nutritional value. Allergen warnings must be prominent as children may be at higher risk. Choking hazard warnings required for small candy, toys in food, and foods with small pieces for children under 3. Serving sizes on child-targeted foods should reflect age-appropriate portions. Juice drinks for children must declare juice percentage. Baby food and infant formula have specific composition and labeling requirements. Claims like "made for kids" should be supported by appropriate nutritional profile.',
  'guideline',
  'United States',
  'FDA Guidance, CPSC Regulations',
  '2017-01-01',
  '2023',
  true
),
(
  'Dietary Supplement Facts Panel',
  'FDA requirements for dietary supplement labeling and supplement facts',
  'Supplements must have Supplement Facts panel, not Nutrition Facts. Must declare serving size, servings per container, and amount per serving of each dietary ingredient. List ingredients present at significant levels. Use %DV when established for nutrients. Dietary ingredients without DVs listed with amount only. Must declare source organism for herbal ingredients. Proprietary blends must show total weight and list ingredients in descending order. "Other ingredients" listed below panel. Structure/function claims require disclaimer: "This statement has not been evaluated by FDA. This product is not intended to diagnose, treat, cure, or prevent any disease." Must meet cGMP requirements. Cannot claim to diagnose, treat, cure, or prevent diseases.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.36, DSHEA',
  '1999-03-23',
  '2023',
  true
),
(
  'Irradiated Food Labeling',
  'FDA requirements for labeling irradiated foods',
  'Irradiated foods must display international radura symbol (green symbol resembling flower in broken circle). Must include statement "Treated with radiation" or "Treated by irradiation." For foods where ingredient was irradiated, ingredient list must note irradiation. Symbol and statement required on front or information panel. Exceptions: irradiated ingredients in multi-ingredient foods if ingredients comprise less than 10% of food do not require labeling. Highly processed irradiated ingredients where irradiation purpose cannot be achieved (like spices at low levels) may be exempt. Retail establishments serving irradiated food must provide notice. Labeling applies to whole foods, processed foods containing irradiated ingredients, and food service.',
  'federal_law',
  'United States',
  'FDA 21 CFR 179.26',
  '1997-12-03',
  '2020',
  true
),
(
  'Religious Dietary Labeling Standards',
  'Standards and requirements for kosher and halal labeling claims',
  'Kosher and halal terms are voluntary but must be truthful if used. FDA does not verify religious dietary claims but monitors for false/misleading statements. Products claiming kosher typically certified by recognized rabbinical authority; certification symbol should be displayed. Halal claims should be verified by recognized Islamic certification body. False kosher/halal claims subject to action as misbranding. State laws may impose additional requirements. Claims must reflect actual religious standards, not merely absence of certain ingredients. Certification standards may vary by certifying organization. Products should clearly identify certifying organization. Manufacturing processes and facilities may need to meet religious standards, not just ingredients.',
  'guideline',
  'United States',
  'FDA FDCA Section 403, State Laws',
  '2000-01-01',
  '2023',
  true
),
(
  'Fat Content Nutrient Claims',
  'Definitions and requirements for fat-related nutrient content claims',
  'Fat-free: Less than 0.5g fat per serving. Low-fat: 3g or less fat per serving (for meals: 3g or less per 100g and no more than 30% calories from fat). Reduced-fat: At least 25% less fat than reference food. Light (fat): 50% less fat than reference food (or 1/3 fewer calories if less than 50% calories from fat). Lean (meat/poultry): Less than 10g fat, 4.5g saturated fat, and 95mg cholesterol per serving and per 100g. Extra lean: Less than 5g fat, 2g saturated fat, and 95mg cholesterol per serving and per 100g. Percent fat-free: May be used on low-fat or fat-free products; must accurately reflect fat content (e.g., "95% fat-free" = 5% fat by weight). All fat claims must meet definition criteria per RACC and per 50g if RACC is small.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.62',
  '1994-01-01',
  '2020',
  true
)
ON CONFLICT DO NOTHING;