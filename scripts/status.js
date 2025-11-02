#!/usr/bin/env node
/**
 * Quick Status Script
 * Shows comprehensive repository status
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch (error) {
    return error.stdout ? error.stdout.trim() : '';
  }
}

function hasOutput(command) {
  const output = exec(command);
  return output.length > 0;
}

console.log('📊 Repository Status');
console.log('═══════════════════════════════════════════════════════\n');

// Branch info
const branch = exec('git branch --show-current');
console.log('📍 Current Branch:');
console.log(`   ${branch}\n`);

// Last commit
const lastCommit = exec('git log -1 --format="%h - %s (%ar)"');
console.log('🕐 Last Commit:');
console.log(`   ${lastCommit}\n`);

// Uncommitted changes
console.log('📝 Uncommitted Changes:');
if (hasOutput('git status --porcelain')) {
  const changes = exec('git status --short');
  changes.split('\n').forEach((line) => console.log(`   ${line}`));
} else {
  console.log('   (none)');
}
console.log('');

// Unpushed commits
console.log('⬆️  Unpushed Commits:');
const unpushed = exec('git log origin/main..HEAD --oneline');
if (unpushed) {
  unpushed.split('\n').forEach((line) => console.log(`   ${line}`));
} else {
  console.log('   (none)');
}
console.log('');

// Stashed changes
console.log('💾 Stashed Changes:');
const stashed = exec('git stash list');
if (stashed) {
  stashed.split('\n').forEach((line) => console.log(`   ${line}`));
} else {
  console.log('   (none)');
}
console.log('');

// Sync status
exec('git fetch origin main --quiet 2>/dev/null || true');
const local = exec('git rev-parse @');
const remote = exec('git rev-parse @{u}');

console.log('🔄 Sync Status:');
if (local === remote) {
  console.log('   ✅ In sync with origin/main');
} else {
  console.log('   ⚠️  Out of sync with origin/main');

  const behind = exec('git rev-list HEAD..origin/main --count') || '0';
  const ahead = exec('git rev-list origin/main..HEAD --count') || '0';

  if (behind !== '0') {
    console.log(`   📥 Behind by ${behind} commits (run: git pull)`);
  }
  if (ahead !== '0') {
    console.log(`   📤 Ahead by ${ahead} commits (run: git push)`);
  }
}
console.log('');

// Environment check
console.log('🔐 Environment:');
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env.local exists');
} else {
  console.log('   ❌ .env.local missing');
}
console.log('');

// Node modules check
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('📦 Dependencies: Installed');
} else {
  console.log('📦 Dependencies: Not installed (run: npm install)');
}
console.log('');

console.log('═══════════════════════════════════════════════════════');

process.exit(0);
