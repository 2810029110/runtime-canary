const COMMON_SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\b(?:api[_-]?key|access[_-]?token|secret)\s*[=:]\s*[^\s,;]+/gi,
  /\bAuthorization:\s*Bearer\s+[^\s]+/gi,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(value: string, secrets: string[] = []): string {
  let redacted = value;

  for (const secret of secrets.filter((item) => item.length >= 4)) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }

  for (const pattern of COMMON_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}
