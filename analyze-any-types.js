/**
 * Script to analyze and categorize 'any' type usage in the codebase
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all instances
const output = execSync(
  'grep -r "\\bany\\b" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git -n .',
  { encoding: 'utf-8' }
);

const lines = output.trim().split('\n');

const categories = {
  // Justified cases
  textContent: [], // "any label", "any time", etc. (not TypeScript any)
  testCases: [], // Test environment mocks
  thirdPartyTypes: [], // jsPDF, etc. with missing types
  errorHandling: [], // catch (error: any)
  logger: [], // Logger data: Record<string, any>

  // Needs fixing
  stateTypes: [], // useState<any>
  componentProps: [], // Props with any
  typeAssertions: [], // as any
  functionReturns: [], // Return type any
  other: [],
};

const justifiedPatterns = {
  textContent:
    /(any label|any time|any of|any issues|any new|any prominent|any rotated|any similar|any promotional|any other|any dietary|any differences)/i,
  testCases: /__tests__|\.test\.|\.spec\./,
  thirdPartyTypes: /(doc as any|jspdf|lastAutoTable)/i,
  errorHandling: /catch.*error.*:.*any|catch.*\(error:.*any\)/i,
  logger: /Record<string,\s*any>.*log|data\?:\s*Record<string,\s*any>/i,
};

lines.forEach((line) => {
  const [filePath, ...rest] = line.split(':');
  const content = rest.join(':');

  // Check justified patterns first
  if (justifiedPatterns.textContent.test(content)) {
    categories.textContent.push({ file: filePath, line: content.trim() });
  } else if (justifiedPatterns.testCases.test(filePath)) {
    categories.testCases.push({ file: filePath, line: content.trim() });
  } else if (justifiedPatterns.thirdPartyTypes.test(content)) {
    categories.thirdPartyTypes.push({ file: filePath, line: content.trim() });
  } else if (justifiedPatterns.errorHandling.test(content)) {
    categories.errorHandling.push({ file: filePath, line: content.trim() });
  } else if (justifiedPatterns.logger.test(content)) {
    categories.logger.push({ file: filePath, line: content.trim() });
  }
  // Check needs-fixing patterns
  else if (/useState<any>|useState<any\[\]>/.test(content)) {
    categories.stateTypes.push({ file: filePath, line: content.trim() });
  } else if (/:\s*any[,;\)\]]|:\s*any\[\]/.test(content)) {
    categories.componentProps.push({ file: filePath, line: content.trim() });
  } else if (/as any/.test(content)) {
    categories.typeAssertions.push({ file: filePath, line: content.trim() });
  } else if (/:\s*Promise<.*any/.test(content)) {
    categories.functionReturns.push({ file: filePath, line: content.trim() });
  } else {
    categories.other.push({ file: filePath, line: content.trim() });
  }
});

// Print categorized results
console.log('='.repeat(80));
console.log('ANY TYPE ANALYSIS');
console.log('='.repeat(80));
console.log();

console.log('✅ JUSTIFIED (Keep as-is with JSDoc)');
console.log('-'.repeat(80));
console.log(`Text Content (not TypeScript 'any'): ${categories.textContent.length}`);
console.log(`Test Cases (environment mocks): ${categories.testCases.length}`);
console.log(`Third-Party Types (missing definitions): ${categories.thirdPartyTypes.length}`);
console.log(`Error Handling (catch blocks): ${categories.errorHandling.length}`);
console.log(`Logger (flexible data objects): ${categories.logger.length}`);
const justifiedTotal =
  categories.textContent.length +
  categories.testCases.length +
  categories.thirdPartyTypes.length +
  categories.errorHandling.length +
  categories.logger.length;
console.log(`TOTAL JUSTIFIED: ${justifiedTotal}`);
console.log();

console.log('⚠️  NEEDS FIXING');
console.log('-'.repeat(80));
console.log(`State Types (useState<any>): ${categories.stateTypes.length}`);
console.log(`Component Props (props: any): ${categories.componentProps.length}`);
console.log(`Type Assertions (as any): ${categories.typeAssertions.length}`);
console.log(`Function Returns (returns any): ${categories.functionReturns.length}`);
console.log(`Other: ${categories.other.length}`);
const needsFixingTotal =
  categories.stateTypes.length +
  categories.componentProps.length +
  categories.typeAssertions.length +
  categories.functionReturns.length +
  categories.other.length;
console.log(`TOTAL NEEDS FIXING: ${needsFixingTotal}`);
console.log();

console.log('GRAND TOTAL:', justifiedTotal + needsFixingTotal);
console.log();

// Print details for items needing fixing
if (categories.stateTypes.length > 0) {
  console.log('STATE TYPES TO FIX:');
  categories.stateTypes.forEach((item) => {
    console.log(`  ${item.file}`);
    console.log(`    ${item.line}`);
  });
  console.log();
}

if (categories.typeAssertions.length > 0) {
  console.log('TYPE ASSERTIONS TO FIX (first 20):');
  categories.typeAssertions.slice(0, 20).forEach((item) => {
    console.log(`  ${item.file}`);
    console.log(`    ${item.line}`);
  });
  console.log();
}

if (categories.componentProps.length > 0) {
  console.log('COMPONENT PROPS TO FIX:');
  categories.componentProps.forEach((item) => {
    console.log(`  ${item.file}`);
    console.log(`    ${item.line}`);
  });
  console.log();
}
