// server/logger.ts
// Smart Pen Academy - Enterprise Log4j-style Domain Logger
// Outputs strictly to stdout/stderr (zero local file persistence for Render/container compatibility)

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const SENSITIVE_KEY_REGEX = /password|token|secret|authorization|cookie|apikey|api_key|credential|session|bearer|hash|service_role/i;
const JWT_REGEX = /^eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*$/;
const API_KEY_PREFIX_REGEX = /^(sbp_|re_|AIza)[A-Za-z0-9_-]{10,}/;

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and strings.
 * Includes circular reference detection via WeakSet.
 */
export function redactSensitiveData(data: any, seen = new WeakSet()): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (JWT_REGEX.test(data.trim())) {
      return '[REDACTED_JWT_TOKEN]';
    }
    if (API_KEY_PREFIX_REGEX.test(data.trim())) {
      return '[REDACTED_API_KEY]';
    }
    if (/^Bearer\s+[A-Za-z0-9-_.]+/i.test(data.trim())) {
      return 'Bearer [REDACTED_TOKEN]';
    }
    if (data.startsWith('data:image/')) {
      return data.substring(0, 30) + '...[BASE64_IMAGE_TRUNCATED]';
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[CIRCULAR_REFERENCE]';
  }
  seen.add(data);

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: data.stack,
      ...(data as any)
    };
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, seen));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value, seen);
    }
  }
  return result;
}

export class Logger {
  private static instances: Map<string, Logger> = new Map();
  private domain: string;

  private constructor(domain: string) {
    this.domain = domain.toUpperCase();
  }

  public static get(domain: string): Logger {
    const key = domain.toUpperCase();
    if (!Logger.instances.has(key)) {
      Logger.instances.set(key, new Logger(key));
    }
    return Logger.instances.get(key)!;
  }

  private getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel | undefined;
    if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
      return envLevel;
    }
    return process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.getMinLogLevel()];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any, err?: any): string {
    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? redactSensitiveData(meta) : undefined;
    const cleanErr = err ? redactSensitiveData(err) : undefined;

    const logObject: Record<string, any> = {
      timestamp,
      level,
      domain: this.domain,
      message
    };

    if (cleanMeta !== undefined) {
      logObject.meta = cleanMeta;
    }

    if (cleanErr !== undefined) {
      logObject.error = cleanErr;
    }

    // In production, emit standardized single-line JSON for log aggregators (Render, Datadog, etc.)
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logObject);
    }

    // In development, emit human-readable formatted string
    let output = `[${timestamp}] [${level}] [${this.domain}] ${message}`;
    if (cleanMeta) {
      output += `\n  Meta: ${JSON.stringify(cleanMeta, null, 2)}`;
    }
    if (cleanErr) {
      output += `\n  Error: ${cleanErr.stack || JSON.stringify(cleanErr, null, 2)}`;
    }
    return output;
  }

  public debug(message: string, meta?: any): void {
    if (!this.shouldLog('DEBUG')) return;
    process.stdout.write(this.formatMessage('DEBUG', message, meta) + '\n');
  }

  public info(message: string, meta?: any): void {
    if (!this.shouldLog('INFO')) return;
    process.stdout.write(this.formatMessage('INFO', message, meta) + '\n');
  }

  public warn(message: string, meta?: any): void {
    if (!this.shouldLog('WARN')) return;
    process.stdout.write(this.formatMessage('WARN', message, meta) + '\n');
  }

  public error(message: string, err?: any, meta?: any): void {
    if (!this.shouldLog('ERROR')) return;
    process.stderr.write(this.formatMessage('ERROR', message, meta, err) + '\n');
  }

  public fatal(message: string, err?: any, meta?: any): void {
    if (!this.shouldLog('FATAL')) return;
    process.stderr.write(this.formatMessage('FATAL', message, meta, err) + '\n');
  }
}
