#!/usr/bin/env node
/**
 * Pre-Switch Check Script
 * Run this before switching computers to ensure everything is committed and pushed
 */

const { execSync } = require('child_process');

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

console.log('🔍 Checking repository status...\n');

let hasIssues = false;

// Check for uncommitted changes
if (hasOutput('git status --porcelain')) {
  console.log('❌ UNCOMMITTED CHANGES DETECTED:\n');
  console.log(exec('git status --short'));
  console.log('\nAction required:');
  console.log('  1. Review changes: git diff');
  console.log('  2. Stage files: git add .');
  console.log('  3. Commit: git commit -m "your message"');
  console.log('  4. Push: git push\n');
  hasIssues = true;
}

// Check for unpushed commits
const unpushed = exec('git log origin/main..HEAD --oneline');
if (unpushed) {
  console.log('❌ UNPUSHED COMMITS DETECTED:\n');
  console.log(unpushed);
  console.log('\nAction required:');
  console.log('  git push origin main\n');
  hasIssues = true;
}

// Check for stashed changes
const stashed = exec('git stash list');
if (stashed) {
  console.log('⚠️  WARNING: You have stashed changes:\n');
  console.log(stashed);
  console.log('\nConsider:');
  console.log('  git stash pop   (to restore changes)');
  console.log('  git stash clear (to discard all stashes)');
  console.log("\nNote: Stashes are local-only and won't transfer to other computers!\n");
}

// Check if local is behind remote
exec('git fetch origin main --quiet');
const local = exec('git rev-parse @');
const remote = exec('git rev-parse @{u}');

if (local !== remote) {
  console.log('⚠️  WARNING: Your local branch differs from remote!\n');
  console.log('Action required:');
  console.log('  git pull origin main\n');
  hasIssues = true;
}

if (hasIssues) {
  process.exit(1);
}

console.log('✅ Repository is clean and synchronized!');
console.log('✅ All changes are committed and pushed.');
console.log('✅ Safe to switch computers.\n');

process.exit(0);
