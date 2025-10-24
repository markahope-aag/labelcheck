const fs = require('fs');

// Read the raw extracted text
const rawText = fs.readFileSync('grandfather-list-raw.txt', 'utf8');

// Lines to skip (headers, footers, etc.)
const SKIP_PATTERNS = [
  /^Gretchen:/,
  /^Prepared by the$/,
  /^Council for Responsible Nutrition/i,
  /^Ingredients$/i,
  /^CRN Addition\?$/,
  /^IngredientsCRN Addition\?$/,
  /^CRN LIST OF DIETARY INGREDIENTS$/,
  /GRANDFATHERED.*DSHEA/i,
  /^September 1998$/,
  /^\s*$/,  // Empty lines
  /^[0-9]+\/[0-9]+$/,  // Dates like 9/98
  /Dietary Supplement/i,
  /DSHEA/i,
  /NNFA/i,
  /AHPA/i,
  /American Herbal Products/i,
  /National Nutritional Foods/i,
  /grandfathered/i,
  /marketed.*before October 15, 1994/i,
  /new dietary ingredient/i,
  /reference document/i,
  /excipient/i,
  /TruLabel program/i,
  /best evidence/i,
  /member companies/i,
  /recommended.*addition/i,
  /based.*list compiled/i,
  /\.$/,  // Lines ending with period (likely sentences, not ingredients)
  /\?"$/,  // Lines ending with ?" (likely sentences)
  /^with additions/i,
  /^by CRN/i,
  /^By this provision/i,
  /vitamins, minerals, and amino acids/i,
  /were in use prior/i,
  /policy is for any/i,
  /has not independently/i,
  /more complete list/i,
  / were$/,  // Lines ending with "were" (sentence fragments)
  / and$/,  // Lines ending with "and" (sentence fragments)
  / of an$/,  // Lines ending with "of an" (sentence fragments)
  / see$/,  // Lines ending with "see" (sentence fragments)
];

function shouldSkipLine(line) {
  return SKIP_PATTERNS.some(pattern => pattern.test(line));
}

function cleanIngredientName(line) {
  // Remove "CRN Addition" suffix (case insensitive)
  line = line.replace(/CRN Addition\??$/i, '').trim();

  // Remove extra whitespace
  line = line.replace(/\s+/g, ' ').trim();

  return line;
}

// Extract ingredients
const lines = rawText.split('\n');
const ingredients = [];
const seen = new Set(); // Track duplicates

for (const line of lines) {
  const trimmed = line.trim();

  // Skip empty lines or headers
  if (!trimmed || shouldSkipLine(trimmed)) {
    continue;
  }

  // Clean the ingredient name
  const cleaned = cleanIngredientName(trimmed);

  // Skip if empty after cleaning or too short
  if (!cleaned || cleaned.length < 2) {
    continue;
  }

  // Skip if it's clearly not an ingredient (contains certain keywords)
  if (cleaned.match(/This list is compiled|does not constitute|was or was not/i)) {
    continue;
  }

  // Add if not duplicate (case-insensitive)
  const lowerCased = cleaned.toLowerCase();
  if (!seen.has(lowerCased)) {
    seen.add(lowerCased);
    ingredients.push(cleaned);
  }
}

console.log(`Total unique ingredients extracted: ${ingredients.length}`);
console.log('\nFirst 50 ingredients:');
ingredients.slice(0, 50).forEach((ing, i) => {
  console.log(`${i + 1}. ${ing}`);
});

// Save to JSON file
fs.writeFileSync('grandfather-ingredients.json', JSON.stringify(ingredients, null, 2), 'utf8');
console.log('\nFull list saved to: grandfather-ingredients.json');

// Save to CSV for easy review
const csv = ingredients.map(ing => `"${ing.replace(/"/g, '""')}"`).join('\n');
fs.writeFileSync('grandfather-ingredients.csv', 'ingredient_name\n' + csv, 'utf8');
console.log('CSV saved to: grandfather-ingredients.csv');
