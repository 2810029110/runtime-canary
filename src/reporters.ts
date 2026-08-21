import type { ProbeResult, TestResult } from "./domain/types.ts";

const STATUS_MARK = {
  AVAILABLE: "+",
  NOT_INSTALLED: "-",
  UNEXECUTABLE: "!",
  UNSUPPORTED_VERSION: "!",
  PASS: "+",
  ASSERTION_FAILED: "x",
  TIMEOUT: "!",
  RUNTIME_DEGRADED: "!",
  HARNESS_ERROR: "x",
} as const;

export function formatProbe(result: ProbeResult): string {
  const version = result.version ? ` (${result.version})` : "";
  const diagnostic = result.diagnostic ? `\n  ${result.diagnostic}` : "";
  return `[${STATUS_MARK[result.status]}] ${result.runtime}: ${result.status}${version}${diagnostic}`;
}

export function formatTest(result: TestResult): string {
  const lines = [
    `[${STATUS_MARK[result.status]}] ${result.runtime}: ${result.status}`,
    `  duration: ${Math.round(result.durationMs)}ms`,
    `  isolated workspace cleaned: ${result.isolation.cleaned ? "yes" : "no"}`,
  ];
  if (result.evidence) {
    lines.push(`  canary: ${result.evidence.tokenMatched ? "matched" : "missing"}`);
  }
  if (result.diagnostic) lines.push(`  diagnostic: ${result.diagnostic}`);
  return lines.join("\n");
}
