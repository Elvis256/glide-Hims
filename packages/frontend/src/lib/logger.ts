/**
 * Frontend Error Logger
 * 
 * Captures errors in-memory with a circular buffer and provides:
 * - Structured console output with context
 * - In-memory log store (viewable from admin panel or console)
 * - API error logging with request/response details
 * - Global unhandled error/rejection capture
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  context?: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: string;
  url: string;
  userId?: string;
}

const MAX_ENTRIES = 200;
let nextId = 1;
const entries: LogEntry[] = [];

// Late-bound getter — set by store/auth.ts to avoid a circular import.
// Default returns undefined so log entries are still useful even before
// the auth store is loaded.
let userIdGetter: () => string | undefined = () => undefined;
export function setLoggerUserIdGetter(fn: () => string | undefined) {
  userIdGetter = fn;
}
function getCurrentUserId(): string | undefined {
  try {
    return userIdGetter();
  } catch {
    return undefined;
  }
}

function addEntry(entry: Omit<LogEntry, 'id' | 'timestamp' | 'url' | 'userId'>): LogEntry {
  const full: LogEntry = {
    ...entry,
    id: nextId++,
    timestamp: new Date().toISOString(),
    url: window.location.pathname,
    userId: getCurrentUserId(),
  };
  entries.push(full);
  if (entries.length > MAX_ENTRIES) entries.shift();
  return full;
}

function formatForConsole(entry: LogEntry): string {
  const parts = [`[${entry.level.toUpperCase()}]`];
  if (entry.context) parts.push(`[${entry.context}]`);
  parts.push(entry.message);
  return parts.join(' ');
}

export const logger = {
  error(message: string, context?: string, details?: Record<string, unknown>, error?: Error) {
    const entry = addEntry({
      level: 'error',
      message,
      context,
      details,
      stack: error?.stack,
    });
    console.error(formatForConsole(entry), details || '', error || '');
    return entry;
  },

  warn(message: string, context?: string, details?: Record<string, unknown>) {
    const entry = addEntry({ level: 'warn', message, context, details });
    console.warn(formatForConsole(entry), details || '');
    return entry;
  },

  info(message: string, context?: string, details?: Record<string, unknown>) {
    const entry = addEntry({ level: 'info', message, context, details });
    console.info(formatForConsole(entry), details || '');
    return entry;
  },

  debug(message: string, context?: string, details?: Record<string, unknown>) {
    const entry = addEntry({ level: 'debug', message, context, details });
    console.debug(formatForConsole(entry), details || '');
    return entry;
  },

  /** Log an API error with request/response context */
  apiError(method: string, url: string, status: number | undefined, responseData: unknown, error?: Error) {
    return this.error(
      `${method.toUpperCase()} ${url} → ${status || 'NETWORK_ERROR'}`,
      'API',
      {
        method,
        url,
        status,
        response: typeof responseData === 'object' ? responseData : { raw: String(responseData) },
      },
      error,
    );
  },

  /** Log an ErrorBoundary catch */
  componentError(componentName: string, error: Error, errorInfo?: { componentStack?: string }) {
    return this.error(
      `Component crash: ${error.message}`,
      componentName || 'ErrorBoundary',
      { componentStack: errorInfo?.componentStack },
      error,
    );
  },

  /** Get all log entries (newest first) */
  getEntries(level?: LogLevel): LogEntry[] {
    const result = level ? entries.filter(e => e.level === level) : [...entries];
    return result.reverse();
  },

  /** Clear all entries */
  clear() {
    entries.length = 0;
  },

  /** Get summary counts */
  getSummary() {
    return {
      total: entries.length,
      errors: entries.filter(e => e.level === 'error').length,
      warnings: entries.filter(e => e.level === 'warn').length,
      info: entries.filter(e => e.level === 'info').length,
    };
  },

  /** Export all logs as JSON string (for copy-paste support) */
  export(): string {
    return JSON.stringify(this.getEntries(), null, 2);
  },
};

/** Install global handlers for unhandled errors and rejections */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logger.error(
      event.message || 'Unhandled error',
      'Global',
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
      event.error instanceof Error ? event.error : undefined,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error(
      `Unhandled promise rejection: ${message}`,
      'Global',
      {},
      reason instanceof Error ? reason : undefined,
    );
  });

  logger.info('Error logging initialized', 'Logger');
}

// Expose to browser console for debugging only in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__logs = {
    all: () => logger.getEntries(),
    errors: () => logger.getEntries('error'),
    warnings: () => logger.getEntries('warn'),
    summary: () => logger.getSummary(),
    export: () => { console.log(logger.export()); return 'Logs printed above'; },
    clear: () => { logger.clear(); return 'Logs cleared'; },
  };
}
