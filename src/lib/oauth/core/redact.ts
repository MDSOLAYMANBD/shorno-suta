// Production-safe redaction. Strips secrets/tokens from objects before logging
// or copying to clipboard. Used by diagnostics and "Copy debug bundle".

const SECRET_KEY_RE = /access_token|app_secret|client_secret|refresh_token|verify_token|signing_secret|^code$|^_token$|bearer/i;
const TOKEN_LIKE_RE = /^[A-Za-z0-9_\-+=.\/]{40,}$/;

function redactValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (SECRET_KEY_RE.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    // Strip token-like substrings inside URLs (e.g. ?access_token=EAAB…&code=AQB…)
    if (/access_token=|client_secret=|[?&]code=/.test(value)) {
      return value
        .replace(/(access_token=)[^&\s]+/gi, '$1[REDACTED]')
        .replace(/(client_secret=)[^&\s]+/gi, '$1[REDACTED]')
        .replace(/([?&]code=)[^&\s]+/gi, '$1[REDACTED]');
    }
    if (TOKEN_LIKE_RE.test(value) && value.length > 60) return '[REDACTED:' + value.length + 'chars]';
  }
  return value;
}

export function redact<T>(input: T): T {
  if (input == null) return input;
  if (Array.isArray(input)) return input.map(v => redact(v)) as unknown as T;
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const r = redactValue(k, v);
      out[k] = (r && typeof r === 'object') ? redact(r) : r;
    }
    return out as unknown as T;
  }
  return redactValue('', input) as T;
}

export function safeLog(scope: string, ...args: unknown[]) {
  try { console.log(`[oauth:${scope}]`, ...args.map(a => redact(a))); } catch {}
}
