#!/usr/bin/env node
/**
 * Render Log Monitor Agent
 *
 * Automatically monitors Render application/build logs via the Render REST API,
 * detects errors/exceptions, sanitizes sensitive secrets (tokens, keys, passwords),
 * and appends structured error reports to `logs/render-errors.log`.
 *
 * Usage:
 *   npx tsx scripts/monitor-render-logs.ts              # Run once and record new errors
 *   npx tsx scripts/monitor-render-logs.ts --watch      # Continuous polling in background
 *   npx tsx scripts/monitor-render-logs.ts --dry-run    # Inspect without writing to log file
 *   npx tsx scripts/monitor-render-logs.ts --help       # Display options
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default configurations
const DEFAULT_LOG_FILE = path.join(rootDir, 'logs', 'render-errors.log');
const DEFAULT_WATERMARK_FILE = path.join(rootDir, '.render-log-watermark.json');
const RENDER_API_BASE = 'https://api.render.com/v1';

interface CliArgs {
  watch: boolean;
  interval: number;
  type: 'app' | 'build' | 'request';
  limit: number;
  output: string;
  watermark: string;
  dryRun: boolean;
  resetWatermark: boolean;
  githubAction: boolean;
  help: boolean;
}

interface LogLabel {
  name: string;
  value: string;
}

interface LogEntry {
  id?: string;
  timestamp: string;
  message: string;
  labels?: Array<LogLabel | string>;
  instance?: string;
}

interface RenderLogsResponse {
  logs?: LogEntry[];
  entries?: LogEntry[];
  hasMore?: boolean;
  nextStartTime?: string;
  nextEndTime?: string;
}

interface WatermarkData {
  lastTimestamp: string;
  lastLogId?: string;
  serviceId: string;
  updatedAt: string;
}

interface RenderService {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  repo?: string;
}

// -----------------------------------------------------------------------------
// CLI Argument Parsing
// -----------------------------------------------------------------------------
function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    watch: false,
    interval: 60,
    type: 'app',
    limit: 100,
    output: DEFAULT_LOG_FILE,
    watermark: DEFAULT_WATERMARK_FILE,
    dryRun: false,
    resetWatermark: false,
    githubAction: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--watch' || arg === '-w') {
      result.watch = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--reset-watermark') {
      result.resetWatermark = true;
    } else if (arg === '--github-action') {
      result.githubAction = true;
    } else if (arg === '--interval' && args[i + 1]) {
      result.interval = Math.max(5, parseInt(args[++i], 10) || 60);
    } else if (arg === '--limit' && args[i + 1]) {
      result.limit = Math.min(100, Math.max(10, parseInt(args[++i], 10) || 100));
    } else if (arg === '--type' && args[i + 1]) {
      const t = args[++i].toLowerCase();
      if (t === 'app' || t === 'build' || t === 'request') {
        result.type = t;
      }
    } else if (arg === '--output' && args[i + 1]) {
      result.output = path.resolve(rootDir, args[++i]);
    } else if (arg === '--watermark' && args[i + 1]) {
      result.watermark = path.resolve(rootDir, args[++i]);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Render Log Monitor Agent

Monitors Render logs via the REST API, detects errors/exceptions, sanitizes secrets,
and appends error entries to your repository's error log file.

Usage:
  npx tsx scripts/monitor-render-logs.ts [options]

Options:
  --once                Run once and exit (default behavior)
  --watch, -w           Continuously monitor in the background
  --interval <seconds>  Polling interval in seconds for --watch mode (default: 60)
  --type <type>         Log stream type: 'app', 'build', or 'request' (default: 'app')
  --limit <number>      Number of log lines to query per request, max 100 (default: 100)
  --output <path>       Destination error log file (default: logs/render-errors.log)
  --watermark <path>    Watermark state file path (default: .render-log-watermark.json)
  --dry-run             Inspect logs and test detection without writing to log file
  --reset-watermark     Clear the watermark to re-evaluate recent logs
  --github-action       Output GitHub Actions step outputs (has_errors, error_count)
  --help, -h            Show this help text

Environment Variables:
  RENDER_API_KEY        Render API token (required, from Render Dashboard > Account Settings > API Keys)
  RENDER_SERVICE_ID     Render Service ID (optional, auto-discovered if not provided)
  RENDER_OWNER_ID       Render Workspace/Owner ID (optional)
`);
}

// -----------------------------------------------------------------------------
// Secret Sanitizer (Defense-in-Depth Compliance)
// -----------------------------------------------------------------------------
export function sanitizeSecrets(text: string): string {
  let sanitized = text;

  // 1. JWT Tokens (header.payload.signature)
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\b/g,
    '[REDACTED_JWT]'
  );

  // 2. Bearer authorization headers
  sanitized = sanitized.replace(
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    'Bearer [REDACTED_TOKEN]'
  );

  // 3. Render API keys
  sanitized = sanitized.replace(
    /\brnd_[A-Za-z0-9]{20,}\b/g,
    '[REDACTED_RENDER_KEY]'
  );

  // 4. Supabase secret/service keys & general API keys
  sanitized = sanitized.replace(
    /\b(sbp_[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z-_]{35}|re_[A-Za-z0-9]{20,})\b/g,
    '[REDACTED_API_KEY]'
  );

  // 5. Database connection string passwords
  sanitized = sanitized.replace(
    /(postgres(?:ql)?:\/\/[^:]+:)([^@\s]+)(@)/gi,
    '$1[REDACTED_PASSWORD]$3'
  );

  // 6. JSON fields containing sensitive secrets
  sanitized = sanitized.replace(
    /("?(?:password|token|secret|jwt|apiKey|api_key|serviceRoleKey)"?\s*[:=]\s*)"[^"]+"/gi,
    '$1"[REDACTED]"'
  );

  return sanitized;
}

// -----------------------------------------------------------------------------
// Error Classification Logic
// -----------------------------------------------------------------------------
export function isErrorEntry(entry: LogEntry): boolean {
  const msg = entry.message || '';

  // Extract normalized key/value pairs from labels
  const labelMap = new Map<string, string>();
  for (const label of entry.labels || []) {
    if (typeof label === 'string') {
      const [k, v] = label.split('=');
      if (k) labelMap.set(k.toLowerCase().trim(), (v || '').toLowerCase().trim());
    } else if (label && typeof label === 'object') {
      if (label.name) labelMap.set(label.name.toLowerCase().trim(), (label.value || '').toLowerCase().trim());
    }
  }

  // 1. Label check: level = error, fatal, critical
  const level = labelMap.get('level');
  if (level && ['error', 'fatal', 'critical', 'err'].includes(level)) {
    return true;
  }

  // 2. Stderr streams often contain errors, check if message looks like an error
  const stream = labelMap.get('stream');
  const isStderr = stream === 'stderr';

  // 3. Node.js / JavaScript runtime exception signatures
  const exceptionPatterns = [
    /\b(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/i,
    /\b(UnhandledPromiseRejection|UnhandledPromiseRejectionWarning|UncaughtException):/i,
    /\b(FATAL ERROR|PANIC):/i,
    /^\s*at\s+(?:[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*\s+)?\(?(?:node:|file:\/\/|[A-Za-z]:\\|\/)[^)\n]+:\d+:\d+\)?/m,
    /node:internal\//i,
    /Process exited with code [1-9]\d*/i,
    /\[(ERROR|FATAL|CRITICAL)\]/i,
    /\bstatus[:= ]+5\d{2}\b/i,
    /\bHTTP\/\d(?:\.\d)?\s+5\d{2}\b/i,
  ];

  if (exceptionPatterns.some((pattern) => pattern.test(msg))) {
    return true;
  }

  // If coming from stderr and contains failure/crash signals
  if (isStderr && /\b(failed|failure|crash|terminated|exception|aborted)\b/i.test(msg)) {
    return true;
  }

  return false;
}

// -----------------------------------------------------------------------------
// Render API Interaction
// -----------------------------------------------------------------------------
async function fetchRenderJson<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'SmartPenAcademy-LogMonitor/1.0',
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Render API request failed [${res.status} ${res.statusText}] for ${url}: ${errorText || '(no response body)'}`
    );
  }

  return (await res.json()) as T;
}

async function discoverService(apiKey: string): Promise<RenderService> {
  const listUrl = `${RENDER_API_BASE}/services?limit=50`;
  interface ServiceItem {
    service: RenderService;
  }

  const items = await fetchRenderJson<ServiceItem[]>(listUrl, apiKey);
  if (!items || items.length === 0) {
    throw new Error('No services found in Render account for the provided API key.');
  }

  // Look for service matching SmartPenAcademy or web_service
  const services = items.map((i) => i.service).filter(Boolean);
  const matched =
    services.find(
      (s) =>
        s.type === 'web_service' &&
        ((s.name && s.name.toLowerCase().includes('smartpen')) ||
          (s.repo && s.repo.toLowerCase().includes('smartpen')))
    ) ||
    services.find((s) => s.type === 'web_service') ||
    services[0];

  if (!matched) {
    throw new Error('Unable to automatically identify a Render service. Please set RENDER_SERVICE_ID in .env.');
  }

  return matched;
}

async function resolveOwnerId(
  apiKey: string,
  explicitOwnerId?: string,
  serviceOwnerId?: string
): Promise<string> {
  if (explicitOwnerId) return explicitOwnerId;
  if (serviceOwnerId) return serviceOwnerId;

  try {
    const listUrl = `${RENDER_API_BASE}/owners?limit=10`;
    interface OwnerItem {
      owner: { id: string; name: string };
    }
    const items = await fetchRenderJson<OwnerItem[]>(listUrl, apiKey);
    if (items && items.length > 0 && items[0].owner?.id) {
      return items[0].owner.id;
    }
  } catch {
    // Fallback if /owners is not accessible
  }
  return '';
}

async function fetchLogs(
  apiKey: string,
  serviceId: string,
  ownerId: string,
  type: string,
  limit: number,
  startTime?: string
): Promise<LogEntry[]> {
  const url = new URL(`${RENDER_API_BASE}/logs`);
  if (ownerId) {
    url.searchParams.set('ownerId', ownerId);
  }
  url.searchParams.set('resource', serviceId);
  url.searchParams.set('type', type);
  url.searchParams.set('limit', String(limit));

  if (startTime) {
    url.searchParams.set('startTime', startTime);
  }

  const data = await fetchRenderJson<RenderLogsResponse | LogEntry[]>(url.toString(), apiKey);

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.logs)) {
    return data.logs;
  }

  if (data && Array.isArray(data.entries)) {
    return data.entries;
  }

  return [];
}

// -----------------------------------------------------------------------------
// Watermark Management
// -----------------------------------------------------------------------------
function readWatermark(filepath: string, serviceId: string): WatermarkData | null {
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      const data = JSON.parse(content) as WatermarkData;
      if (data && data.serviceId === serviceId && data.lastTimestamp) {
        return data;
      }
    }
  } catch {
    // Ignore corrupt watermark and reinitialize
  }
  return null;
}

function writeWatermark(filepath: string, data: WatermarkData): void {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  } catch (err) {
    console.warn(`[monitor] Warning: Failed to write watermark file:`, err);
  }
}

// -----------------------------------------------------------------------------
// Log Output Writer
// -----------------------------------------------------------------------------
function appendErrorsToLog(
  outputPath: string,
  serviceId: string,
  serviceName: string,
  type: string,
  errors: LogEntry[]
): void {
  if (errors.length === 0) return;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const isNewFile = !fs.existsSync(outputPath);
  const buffer: string[] = [];

  if (isNewFile) {
    buffer.push(
      `# Smart Pen Academy - Render Error Log`,
      `# Initialized: ${new Date().toISOString()}`,
      `# Note: Sensitive credentials and authorization tokens are automatically redacted.`,
      `# ==============================================================================`,
      ``
    );
  }

  for (const entry of errors) {
    const timestamp = entry.timestamp || new Date().toISOString();
    const labelsStr =
      entry.labels && entry.labels.length
        ? ` [${entry.labels.map((l) => (typeof l === 'string' ? l : `${l.name}=${l.value}`)).join(', ')}]`
        : '';
    const sanitizedMsg = sanitizeSecrets(entry.message || '').trimEnd();

    buffer.push(
      `--------------------------------------------------------------------------------`,
      `[${timestamp}] SERVICE: ${serviceName} (${serviceId}) | TYPE: ${type}${labelsStr}`,
      sanitizedMsg,
      `--------------------------------------------------------------------------------`,
      ``
    );
  }

  fs.appendFileSync(outputPath, buffer.join('\n'), 'utf8');
}

// -----------------------------------------------------------------------------
// Core Monitoring Cycle
// -----------------------------------------------------------------------------
async function runMonitoringCycle(
  config: CliArgs,
  service: RenderService,
  apiKey: string
): Promise<{ totalQueried: number; errorCount: number }> {
  const watermark = config.resetWatermark
    ? null
    : readWatermark(config.watermark, service.id);

  // If watermark exists, query from lastTimestamp.
  // If no watermark exists, omit startTime to inspect the most recent batch of logs.
  const startTime = watermark?.lastTimestamp;

  console.log(
    `[monitor] Fetching ${config.type} logs for ${service.name} (${service.id})${
      startTime ? ` since ${startTime}` : ' (initial scan)'
    }...`
  );

  const entries = await fetchLogs(
    apiKey,
    service.id,
    service.ownerId,
    config.type,
    config.limit,
    startTime
  );

  // Filter out any entries strictly older or equal to watermark timestamp if same log ID
  const newEntries = entries.filter((e) => {
    if (!e.timestamp) return true;
    if (watermark?.lastTimestamp) {
      if (e.timestamp < watermark.lastTimestamp) return false;
      if (e.timestamp === watermark.lastTimestamp && e.id && e.id === watermark.lastLogId) {
        return false;
      }
    }
    return true;
  });

  // Sort chronologically ascending
  newEntries.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

  // Identify errors
  const detectedErrors = newEntries.filter(isErrorEntry);

  console.log(
    `[monitor] Processed ${newEntries.length} new log entries. Detected ${detectedErrors.length} error(s).`
  );

  if (detectedErrors.length > 0) {
    if (config.dryRun) {
      console.log(`[monitor] [DRY RUN] Would append ${detectedErrors.length} errors to ${config.output}`);
      for (const err of detectedErrors) {
        console.log(`  -> [${err.timestamp}] ${sanitizeSecrets(err.message.slice(0, 120))}...`);
      }
    } else {
      appendErrorsToLog(config.output, service.id, service.name, config.type, detectedErrors);
      console.log(`[monitor] Successfully recorded ${detectedErrors.length} errors to ${config.output}`);
    }
  }

  // Update watermark to the newest timestamp seen
  if (!config.dryRun && newEntries.length > 0) {
    const newest = newEntries[newEntries.length - 1];
    writeWatermark(config.watermark, {
      serviceId: service.id,
      lastTimestamp: newest.timestamp,
      lastLogId: newest.id,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    totalQueried: newEntries.length,
    errorCount: detectedErrors.length,
  };
}

// -----------------------------------------------------------------------------
// Main Entrypoint
// -----------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const apiKey = process.env.RENDER_API_KEY?.trim();
  if (!apiKey) {
    console.error(`
[monitor] ERROR: RENDER_API_KEY environment variable is not set!

To monitor Render logs:
1. Open your Render Dashboard -> Account Settings -> API Keys
2. Create an API Key and add it to your .env file:
   RENDER_API_KEY=rnd_...
3. (Optional) Set RENDER_SERVICE_ID=srv-... if you want to target a specific service.
`);
    process.exit(1);
  }

  // Resolve service configuration
  let service: RenderService;
  const configuredServiceId = process.env.RENDER_SERVICE_ID?.trim();

  if (configuredServiceId) {
    service = {
      id: configuredServiceId,
      name: process.env.RENDER_SERVICE_NAME || 'SmartPenAcademy',
      type: 'web_service',
      ownerId: process.env.RENDER_OWNER_ID || '',
    };
    console.log(`[monitor] Using configured service ID: ${service.id}`);
  } else {
    console.log(`[monitor] No RENDER_SERVICE_ID specified; discovering services via Render API...`);
    service = await discoverService(apiKey);
    console.log(`[monitor] Auto-discovered service: ${service.name} (${service.id})`);
  }

  // Ensure ownerId is resolved for logs endpoint
  service.ownerId = await resolveOwnerId(apiKey, process.env.RENDER_OWNER_ID, service.ownerId);

  if (args.watch) {
    console.log(`[monitor] Starting watcher mode (polling every ${args.interval}s). Press Ctrl+C to stop.\n`);

    const run = async () => {
      try {
        await runMonitoringCycle(args, service, apiKey);
      } catch (err: any) {
        console.error(`[monitor] Cycle error:`, err?.message || err);
      }
    };

    await run();
    setInterval(run, args.interval * 1000);
  } else {
    try {
      const result = await runMonitoringCycle(args, service, apiKey);

      // Support GitHub Actions step outputs if running in CI
      if (args.githubAction && process.env.GITHUB_OUTPUT) {
        const hasErrors = result.errorCount > 0 ? 'true' : 'false';
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_errors=${hasErrors}\nerror_count=${result.errorCount}\n`);
      }
    } catch (err: any) {
      console.error(`[monitor] Execution failed:`, err?.message || err);
      process.exit(1);
    }
  }
}

// Only run main() if executed directly from the CLI
const isDirectExecution =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === path.resolve(__filename) ||
    process.argv[1].endsWith('monitor-render-logs.ts'));

if (isDirectExecution) {
  main().catch((err) => {
    console.error('[monitor] Fatal error:', err);
    process.exit(1);
  });
}
