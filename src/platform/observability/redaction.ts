const SENSITIVE_KEY =
  /password|passphrase|secret|token|authorization|cookie|credential|recovery|private.?key|email|display.?name/i;

export function redactSensitive<T>(value: T): T {
  return redact(value, new WeakSet<object>()) as T;
}

function redact(value: unknown, visited: WeakSet<object>): unknown {
  if (Buffer.isBuffer(value)) return '[REDACTED_BINARY]';
  if (Array.isArray(value)) return value.map((entry) => redact(entry, visited));
  if (!value || typeof value !== 'object') return value;
  if (visited.has(value)) return '[REDACTED_CIRCULAR]';
  visited.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(entry, visited);
  }
  return result;
}
