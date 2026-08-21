export const PROBE_STATUSES = [
  "AVAILABLE",
  "NOT_INSTALLED",
  "UNEXECUTABLE",
  "UNSUPPORTED_VERSION",
] as const;

export type ProbeStatus = (typeof PROBE_STATUSES)[number];

export interface ProbeResult {
  runtime: string;
  status: ProbeStatus;
  command: string;
  version: string | null;
  diagnostic: string | null;
}

export const TEST_STATUSES = [
  "PASS",
  "ASSERTION_FAILED",
  "TIMEOUT",
  "RUNTIME_DEGRADED",
  "HARNESS_ERROR",
] as const;

export type TestStatus = (typeof TEST_STATUSES)[number];

export interface RuntimeInvocation {
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
}

export interface RuntimeContext {
  projectDir: string;
  canaryToken: string;
  simulation: "success" | "timeout" | "startup-failure" | "secret";
  secret?: string;
}

export interface RuntimeAdapter {
  id: string;
  displayName: string;
  probe(): Promise<ProbeResult>;
  createInvocation?(context: RuntimeContext): RuntimeInvocation | Promise<RuntimeInvocation>;
}

export interface CanarySpec {
  relativePath: string;
  expectedToken: string;
}

export interface CanaryEvidence {
  path: string;
  observed: boolean;
  tokenMatched: boolean;
}

export interface CanaryVerifier {
  verify(projectDir: string, spec: CanarySpec): Promise<CanaryEvidence>;
}

export interface ProcessResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  launchError: string | null;
}

export interface TestResult {
  schemaVersion: 1;
  runtime: string;
  status: TestStatus;
  startedAt: string;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  diagnostic: string | null;
  evidence: CanaryEvidence | null;
  isolation: {
    workspaceRoot: string;
    cleaned: boolean;
  };
}
