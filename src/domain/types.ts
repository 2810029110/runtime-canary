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

export const SIMULATION_MODES = [
  "success",
  "timeout",
  "startup-failure",
  "secret",
  "authentication",
  "network",
  "permission",
  "configuration",
  "missing-evidence",
] as const;

export type SimulationMode = (typeof SIMULATION_MODES)[number];

export interface RuntimeContext {
  projectDir: string;
  canaryToken: string;
  simulation: SimulationMode;
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

export const DOCTOR_STATUSES = [
  "READY",
  "DEGRADED",
  "UNAVAILABLE",
  "UNVERIFIED",
] as const;

export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];
export type DoctorCheckStatus = "PASS" | "FAIL" | "NOT_RUN";
export type DoctorFindingCategory =
  | "discovery"
  | "authentication"
  | "network"
  | "permissions"
  | "configuration"
  | "runtime"
  | "evidence"
  | "cleanup";

export interface DoctorFinding {
  code: string;
  category: DoctorFindingCategory;
  summary: string;
  action: string;
}

export interface DoctorCanarySummary {
  status: TestStatus;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  evidence: CanaryEvidence | null;
  cleaned: boolean;
}

export interface DoctorRuntimeResult {
  runtime: string;
  displayName: string;
  status: DoctorStatus;
  version: string | null;
  durationMs: number;
  probeStatus: ProbeStatus;
  canary: DoctorCanarySummary | null;
  checks: {
    discovery: DoctorCheckStatus;
    launch: DoctorCheckStatus;
    task: DoctorCheckStatus;
    evidence: DoctorCheckStatus;
    cleanup: DoctorCheckStatus;
  };
  findings: DoctorFinding[];
}

export interface DoctorReport {
  schemaVersion: 1;
  mode: "probe" | "live";
  generatedAt: string;
  durationMs: number;
  summary: {
    total: number;
    ready: number;
    degraded: number;
    unavailable: number;
    unverified: number;
    checksPassed: number;
    checksFailed: number;
    checksNotRun: number;
  };
  runtimes: DoctorRuntimeResult[];
}
