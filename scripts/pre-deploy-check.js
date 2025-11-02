#!/usr/bin/env node
/**
 * Pre-deployment checklist
 * Run this before pushing to main branch
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Running pre-deployment checks...\n');

const checks = [];
let hasErrors = false;

// Check 1: TypeScript compiles
console.log('1️⃣  Checking TypeScript compilation...');
try {
  execSync('npm run typecheck', { stdio: 'pipe' });
  checks.push({ name: 'TypeScript', status: '✅' });
  console.log('   ✅ TypeScript check passed\n');
} catch (error) {
  checks.push({ name: 'TypeScript', status: '❌' });
  console.log('   ❌ TypeScript errors found!');
  console.log('   Run: npm run typecheck\n');
  hasErrors = true;
}

// Check 2: Linting passes
console.log('2️⃣  Checking ESLint...');
try {
  execSync('npm run lint', { stdio: 'pipe' });
  checks.push({ name: 'ESLint', status: '✅' });
  console.log('   ✅ ESLint check passed\n');
} catch (error) {
  checks.push({ name: 'ESLint', status: '⚠️' });
  console.log('   ⚠️  ESLint warnings found (non-blocking)');
  console.log('   Run: npm run lint -- --fix\n');
}

// Check 3: Code formatting
console.log('3️⃣  Checking code formatting...');
try {
  execSync('npm run format:check', { stdio: 'pipe' });
  checks.push({ name: 'Formatting', status: '✅' });
  console.log('   ✅ Code is properly formatted\n');
} catch (error) {
  checks.push({ name: 'Formatting', status: '⚠️' });
  console.log('   ⚠️  Formatting issues found (non-blocking)');
  console.log('   Run: npm run format\n');
}

// Check 4: Build succeeds
console.log('4️⃣  Testing production build...');
try {
  execSync('npm run build', { stdio: 'pipe' });
  checks.push({ name: 'Build', status: '✅' });
  console.log('   ✅ Build successful\n');
} catch (error) {
  checks.push({ name: 'Build', status: '❌' });
  console.log('   ❌ Build failed!');
  console.log('   Run: npm run build\n');
  hasErrors = true;
}

// Check 5: Check if on main branch
console.log('5️⃣  Checking current branch...');
try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  if (currentBranch === 'main') {
    checks.push({ name: 'Branch', status: '⚠️' });
    console.log('   ⚠️  You are on main branch');
    console.log('   Consider using a feature branch for safety\n');
  } else {
    checks.push({ name: 'Branch', status: '✅' });
    console.log(`   ✅ On feature branch: ${currentBranch}\n`);
  }
} catch (error) {
  checks.push({ name: 'Branch', status: '❌' });
  console.log('   ❌ Could not determine branch\n');
}

// Check 6: Uncommitted changes
console.log('6️⃣  Checking for uncommitted changes...');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (status.trim()) {
    checks.push({ name: 'Uncommitted', status: '⚠️' });
    console.log('   ⚠️  You have uncommitted changes');
    console.log('   Consider committing before deploying\n');
  } else {
    checks.push({ name: 'Uncommitted', status: '✅' });
    console.log('   ✅ All changes committed\n');
  }
} catch (error) {
  checks.push({ name: 'Uncommitted', status: '❌' });
  console.log('   ❌ Could not check git status\n');
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Pre-deployment Check Summary:\n');
checks.forEach((check) => {
  const icon = check.status === '✅' ? '✅' : check.status === '❌' ? '❌' : '⚠️';
  console.log(`   ${icon} ${check.name}: ${check.status}`);
});
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (hasErrors) {
  console.log('❌ DEPLOYMENT BLOCKED: Critical errors found!');
  console.log('   Fix the errors above before deploying.\n');
  process.exit(1);
} else {
  console.log('✅ All critical checks passed!');
  console.log('   You are ready to deploy.\n');
  console.log('   Next steps:');
  console.log('   1. Push to feature branch for preview: git push');
  console.log('   2. Test preview deployment');
  console.log('   3. Merge to main: git checkout main && git merge <branch>');
  console.log('   4. Deploy to production: git push origin main\n');
  process.exit(0);
}
