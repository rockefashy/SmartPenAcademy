import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

async function isSupabaseHealthy(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      signal: controller.signal,
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      }
    });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

function isDockerDaemonReady(): boolean {
  try {
    execSync('docker info --format "{{.ServerVersion}}"', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const isLocal = SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost');
  if (!isLocal) {
    console.log(`[Database Pre-Flight] Configured for remote Supabase Cloud (${SUPABASE_URL}). Skipping local checks.\n`);
    process.exit(0);
  }

  // 1. Check if Supabase is already running
  if (await isSupabaseHealthy(SUPABASE_URL)) {
    console.log(`[Database Pre-Flight] Local Supabase is online and healthy at ${SUPABASE_URL}.\n`);
    process.exit(0);
  }

  console.log(`\n================================================================================`);
  console.log(`[Database Pre-Flight] Local Supabase at ${SUPABASE_URL} is unreachable.`);
  console.log(`Checking Docker engine status...`);

  // 2. Check if Docker daemon is running
  if (!isDockerDaemonReady()) {
    console.log(`\n❌ Docker Desktop is NOT running.`);
    console.log(`\nDue to Windows security policies, Docker Desktop must be launched from your desktop session:`);
    console.log(`\n  👉 1. Open 'Docker Desktop' from your Windows Start Menu.`);
    console.log(`  👉 2. Recommended: In Docker Settings (Gear icon) -> General, enable:`);
    console.log(`        - [x] 'Start Docker Desktop when you sign in to your computer'`);
    console.log(`        - [x] 'Open Docker Desktop in the background'`);
    console.log(`        (This ensures Docker is always ready without manual steps)`);
    console.log(`  👉 3. Re-run 'npm run dev' - Supabase will start automatically!`);
    console.log(`================================================================================\n`);
    process.exit(1);
  }

  // 3. Docker is running! Automatically start Supabase containers
  console.log(`Docker engine is active. Starting local Supabase containers automatically...`);
  try {
    execSync('npx supabase start', { stdio: 'inherit' });
    console.log(`\n[Database Pre-Flight] Local Supabase containers started successfully!`);
    console.log(`================================================================================\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n[Database Pre-Flight ERROR] Failed to start Supabase containers:`, err.message || err);
    console.log(`================================================================================\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Database Pre-Flight ERROR] Unexpected error:', err);
  process.exit(1);
});
