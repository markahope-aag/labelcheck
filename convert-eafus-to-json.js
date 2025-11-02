const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('📊 Converting FDA EAFUS Excel data to JSON...\n');

// Path to the downloaded Excel file
const excelPath = path.join(__dirname, 'data', 'fda-food-substances.xlsx');

if (!fs.existsSync(excelPath)) {
  console.error('❌ Excel file not found!');
  console.error(`   Expected location: ${excelPath}`);
  console.error('\n📥 Please download the file first:');
  console.error(
    '   1. Go to: https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances'
  );
  console.error('   2. Click "Download data...in Excel format"');
  console.error('   3. Save as: data/fda-food-substances.xlsx\n');
  process.exit(1);
}

console.log('✅ Found Excel file');
console.log('📖 Reading Excel data...\n');

try {
  // Read the Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const rawData = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📦 Found ${rawData.length} substances in Excel file\n`);

  // Transform to our format
  const ingredients = rawData
    .map((row) => {
      // Get the substance name (may be in different column names)
      const substanceName = row['Substance'] || row['Substance name'] || row['Name'] || '';

      // Get CAS number
      const casNumber = row['CAS Reg. No.'] || row['CAS Registry Number'] || row['CAS'] || null;

      // Get technical effect (category)
      const technicalEffect = row['Used for'] || row['Technical Effect'] || row['Used For'] || '';

      // Get CFR reference
      const cfrReference = row['21 CFR'] || row['CFR'] || row['21 CFR reference'] || '';

      // Determine GRAS status based on CFR reference
      let grasStatus = 'affirmed';
      let sourceReference = cfrReference;

      if (cfrReference && cfrReference.includes('182')) {
        grasStatus = 'affirmed';
        sourceReference = cfrReference;
      } else if (cfrReference && cfrReference.includes('184')) {
        grasStatus = 'affirmed';
        sourceReference = cfrReference;
      } else if (cfrReference && cfrReference.includes('172')) {
        grasStatus = 'affirmed'; // Food additives
        sourceReference = cfrReference;
      } else if (cfrReference && cfrReference.includes('173')) {
        grasStatus = 'affirmed'; // Secondary food additives
        sourceReference = cfrReference;
      } else {
        grasStatus = 'notice'; // Likely GRAS notice or other approval
        sourceReference = cfrReference || 'FDA approved';
      }

      // Categorize based on technical effect
      let category = 'food additive';
      if (technicalEffect) {
        const effect = technicalEffect.toLowerCase();
        if (effect.includes('preserv')) category = 'preservative';
        else if (effect.includes('sweet')) category = 'sweetener';
        else if (effect.includes('color') || effect.includes('colour')) category = 'colorant';
        else if (effect.includes('flavor') || effect.includes('flavour')) category = 'flavor';
        else if (effect.includes('emuls')) category = 'emulsifier';
        else if (effect.includes('thick') || effect.includes('stabil')) category = 'thickener';
        else if (effect.includes('acid')) category = 'acidulant';
        else if (effect.includes('antiox')) category = 'antioxidant';
        else if (effect.includes('leaven')) category = 'leavening agent';
        else if (
          effect.includes('nutrient') ||
          effect.includes('vitamin') ||
          effect.includes('mineral')
        )
          category = 'nutrient';
        else category = technicalEffect.substring(0, 50); // Use first part of technical effect
      }

      return {
        ingredient_name: substanceName.trim(),
        cas_number: casNumber ? String(casNumber).trim() : null,
        gras_status: grasStatus,
        source_reference: sourceReference || 'FDA Substances Added to Food',
        category: category,
        synonyms: [], // Will need to add manually or from other sources
        common_name: substanceName.trim(),
      };
    })
    .filter((ing) => ing.ingredient_name && ing.ingredient_name.length > 0); // Filter out empty names

  console.log(`✅ Converted ${ingredients.length} valid ingredients\n`);

  // Save to JSON
  const outputPath = path.join(__dirname, 'data', 'eafus-ingredients.json');
  fs.writeFileSync(outputPath, JSON.stringify(ingredients, null, 2));

  console.log(`💾 Saved to: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total substances: ${ingredients.length}`);

  // Count by category
  const categoryCounts = ingredients.reduce((acc, ing) => {
    acc[ing.category] = (acc[ing.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n   Categories:`);
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 categories
    .forEach(([cat, count]) => {
      console.log(`      ${cat}: ${count}`);
    });

  console.log(`\n✅ Conversion complete!`);
  console.log(`\n📝 Next step: Run 'node import-eafus-data.js' to import into database\n`);
} catch (error) {
  console.error('❌ Error converting Excel file:', error.message);
  console.error('\nMake sure you have installed the xlsx library:');
  console.error('   npm install xlsx\n');
  process.exit(1);
}
