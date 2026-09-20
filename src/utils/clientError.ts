/**
 * src/utils/clientError.ts
 * Centralized Client-Side Error Normalization & Observability Framework
 *
 * Normalizes caught exceptions into clean, user-friendly messages,
 * translates raw network errors, and ensures structured, searchable
 * console logging across all frontend UI components.
 */

export interface HandledClientError {
  message: string;
  source: string;
  timestamp: string;
  originalError: unknown;
}

/**
 * Standard client error handler for catch blocks.
 *
 * @param source Identifier for the error site (e.g. 'StudentDetailPage.saveProfile')
 * @param err The caught exception (unknown / Error)
 * @param fallbackMessage Fallback text if no meaningful error message is extracted
 * @returns Clean, user-ready error message string
 */
export function handleClientError(
  source: string,
  err: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  const timestamp = new Date().toISOString();

  let message = fallbackMessage;
  if (err instanceof Error) {
    message = err.message || message;
  } else if (typeof err === 'string' && err.trim().length > 0) {
    message = err;
  } else if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    message = (err as any).message;
  }

  // Normalize generic browser network drop messages
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('Load failed')
  ) {
    message = 'Unable to connect to server. Please check your internet connection.';
  }

  // Centralized structured console output for debugging in DevTools
  console.error(`[${source}] [${timestamp}] ${message}`, err);

  // Non-blocking telemetry forwarder to backend server & local log file
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      fetch('/api/logs/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          message,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp,
          url: window.location?.href,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
        }),
        keepalive: true
      }).catch(() => {
        // Silently swallow reporting network errors to prevent recursive error loops
      });
    } catch {
      // Silently ignore synchronous dispatch issues
    }
  }

  return message;
}

