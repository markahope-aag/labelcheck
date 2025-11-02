#!/usr/bin/env node
/**
 * Post-Pull Setup Script
 * Run this when starting work on a new computer
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, silent = false) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return silent ? output.trim() : '';
  } catch (error) {
    if (silent && error.stdout) {
      return error.stdout.trim();
    }
    throw error;
  }
}

console.log('🔄 Setting up workspace...\n');

// Pull latest changes
console.log('📥 Pulling latest code from GitHub...');
exec('git pull origin main');
console.log('');

// Check if package-lock.json changed
const packageLockChanged = exec('git diff HEAD@{1} HEAD --name-only', true).includes(
  'package-lock.json'
);

if (packageLockChanged) {
  console.log('📦 Dependencies updated - installing...');
  exec('npm install');
  console.log('');
} else {
  console.log('📦 Dependencies unchanged - skipping install\n');
}

// Clear Next.js cache
const nextDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextDir)) {
  console.log('🧹 Clearing Next.js build cache...');
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('');
}

// Check for environment file
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  WARNING: .env.local not found!\n');
  console.log('Action required:');
  console.log('  1. Copy .env.example to .env.local');
  console.log('  2. Fill in your environment-specific values');
  console.log("  3. Never commit .env.local (it's in .gitignore)\n");
}

// Show current status
const branch = exec('git branch --show-current', true);
const lastCommit = exec('git log -1 --oneline', true);

console.log('📊 Current Status:');
console.log(`  Branch: ${branch}`);
console.log(`  Latest: ${lastCommit}\n`);

console.log('✅ Workspace ready!\n');
console.log('Next steps:');
console.log('  npm run dev       # Start development server');
console.log('  npm run typecheck # Check TypeScript types\n');

process.exit(0);
