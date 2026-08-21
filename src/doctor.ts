import { runRuntimeTest, type RunRuntimeTestOptions } from "./run-test.ts";
import { redactText } from "./redaction.ts";
import type {
  DoctorCheckStatus,
  DoctorFinding,
  DoctorReport,
  DoctorRuntimeResult,
  ProbeResult,
  RuntimeAdapter,
  TestResult,
} from "./domain/types.ts";

export interface RunDoctorOptions {
  adapters: RuntimeAdapter[];
  live?: boolean;
  timeoutMs?: number;
  simulation?: RunRuntimeTestOptions["simulation"];
  runTest?: typeof runRuntimeTest;
}

const AUTH_PATTERN = /(\b(?:401|403)\b.*\b(?:unauthorized|forbidden)\b|invalid api key|auth(?:entication)? (?:failed|required)|login required|not logged in|credential.{0,30}(?:invalid|expired|rejected)|invalid license)/i;
const NETWORK_PATTERN = /(dns.{0,30}(?:failed|resolve|error)|(?:tls|ssl).{0,30}(?:failed|error)|proxy.{0,30}(?:blocked|failed|error)|websocket.{0,30}(?:closed|failed|error)|network.{0,30}(?:failed|unreachable|error)|connection.{0,30}(?:closed|failed|refused|reset|timeout)|\b503\b)/i;
const PERMISSION_PATTERN = /(permission denied|access denied|\b(?:eacces|eperm)\b|sandbox.{0,30}(?:denied|failed|error|read[ -]?only)|read[ -]?only.{0,30}(?:filesystem|sandbox|workspace)|approval (?:denied|required))/i;
const CONFIG_PATTERN = /(invalid (?:config|configuration|settings|toml)|(?:config|configuration|settings|toml).{0,30}(?:failed|invalid|error)|(?:mcp|plugin|hook).{0,30}(?:failed|invalid|error|timeout))/i;

function finding(
  code: string,
  category: DoctorFinding["category"],
  summary: string,
  action: string,
): DoctorFinding {
  return { code, category, summary, action };
}

function probeResult(
  adapter: RuntimeAdapter,
  probe: ProbeResult,
): DoctorRuntimeResult {
  const base = {
    runtime: adapter.id,
    displayName: adapter.displayName,
    version: probe.version,
    durationMs: 0,
    probeStatus: probe.status,
    canary: null,
  };

  if (probe.status === "NOT_INSTALLED") {
    return {
      ...base,
      status: "UNAVAILABLE",
      checks: allChecks("FAIL", "NOT_RUN"),
      findings: [finding(
        "RUNTIME_NOT_INSTALLED",
        "discovery",
        `${adapter.displayName} was not found on PATH.`,
        `Install ${adapter.displayName} or provide an explicit executable path.`,
      )],
    };
  }

  if (probe.status === "UNSUPPORTED_VERSION") {
    return {
      ...base,
      status: "DEGRADED",
      checks: allChecks("PASS", "NOT_RUN", "PASS"),
      findings: [finding(
        "UNSUPPORTED_VERSION",
        "discovery",
        `${adapter.displayName} returned an unsupported version.`,
        "Upgrade or select a version supported by this adapter.",
      )],
    };
  }

  return {
    ...base,
    status: "DEGRADED",
    checks: allChecks("PASS", "NOT_RUN", "FAIL"),
    findings: [finding(
      "RUNTIME_UNEXECUTABLE",
      "discovery",
      `${adapter.displayName} was found but could not be launched.`,
      "Check executable permissions, PATH ordering, and platform compatibility.",
    )],
  };
}

function allChecks(
  discovery: DoctorCheckStatus,
  remaining: DoctorCheckStatus,
  launch = remaining,
): DoctorRuntimeResult["checks"] {
  return {
    discovery,
    launch,
    task: remaining,
    evidence: remaining,
    cleanup: remaining,
  };
}

function classifyFailure(result: TestResult): DoctorFinding {
  const output = `${result.diagnostic ?? ""}\n${result.stderr}\n${result.stdout}`;
  if (AUTH_PATTERN.test(output)) {
    return finding(
      "AUTHENTICATION_FAILED",
      "authentication",
      "The runtime started, but its credential was rejected or unavailable.",
      "Refresh the runtime's supported credential source, then rerun the live check.",
    );
  }
  if (NETWORK_PATTERN.test(output)) {
    return finding(
      "NETWORK_FAILED",
      "network",
      "The runtime could not complete its network connection.",
      "Check DNS, TLS inspection, proxy settings, firewall policy, and service status.",
    );
  }
  if (PERMISSION_PATTERN.test(output)) {
    return finding(
      "PERMISSION_FAILED",
      "permissions",
      "The runtime was blocked by sandbox or filesystem permissions.",
      "Grant workspace write access or repair the runtime's sandbox setup.",
    );
  }
  if (CONFIG_PATTERN.test(output)) {
    return finding(
      "CONFIGURATION_FAILED",
      "configuration",
      "Runtime configuration, MCP, plugin, or hook startup failed.",
      "Validate the referenced configuration and disable the failing integration.",
    );
  }
  return finding(
    "RUNTIME_FAILED",
    "runtime",
    "The runtime exited before completing the canary.",
    "Inspect the redacted runtime output and rerun with the smallest configuration.",
  );
}

function liveResult(
  adapter: RuntimeAdapter,
  probe: ProbeResult,
  canary: TestResult,
): DoctorRuntimeResult {
  const cleanup = canary.isolation.cleaned ? "PASS" : "FAIL";
  const base = {
    runtime: adapter.id,
    displayName: adapter.displayName,
    version: probe.version,
    durationMs: canary.durationMs,
    probeStatus: probe.status,
    canary: {
      status: canary.status,
      durationMs: canary.durationMs,
      exitCode: canary.exitCode,
      timedOut: canary.timedOut,
      evidence: canary.evidence,
      cleaned: canary.isolation.cleaned,
    },
  };

  if (canary.status === "PASS" && cleanup === "PASS") {
    return {
      ...base,
      status: "READY",
      checks: allChecks("PASS", "PASS"),
      findings: [],
    };
  }

  const findings: DoctorFinding[] = [];
  let task: DoctorCheckStatus = "FAIL";
  let evidence: DoctorCheckStatus = "NOT_RUN";

  if (canary.status === "TIMEOUT") {
    findings.push(finding(
      "RUNTIME_TIMEOUT",
      "runtime",
      "The runtime did not finish the canary before the timeout.",
      "Check model latency, network connectivity, MCP startup, and stuck child processes.",
    ));
  } else if (canary.status === "ASSERTION_FAILED") {
    task = "PASS";
    evidence = "FAIL";
    findings.push(finding(
      "EVIDENCE_MISSING",
      "evidence",
      "The runtime exited successfully without producing the expected file evidence.",
      "Check tool availability, workspace permissions, and instruction handling.",
    ));
  } else if (canary.status === "HARNESS_ERROR") {
    findings.push(finding(
      "HARNESS_ERROR",
      "runtime",
      "The canary harness could not run this adapter.",
      "Check the adapter invocation and isolated workspace setup.",
    ));
  } else {
    findings.push(classifyFailure(canary));
  }

  if (cleanup === "FAIL") {
    findings.push(finding(
      "CLEANUP_FAILED",
      "cleanup",
      "The isolated workspace was not fully removed.",
      "Remove the reported workspace and check for surviving child processes or file locks.",
    ));
  }

  return {
    ...base,
    status: "DEGRADED",
    checks: {
      discovery: "PASS",
      launch: "PASS",
      task,
      evidence,
      cleanup,
    },
    findings,
  };
}

function summarize(runtimes: DoctorRuntimeResult[]): DoctorReport["summary"] {
  const checks = runtimes.flatMap((runtime) => Object.values(runtime.checks));
  return {
    total: runtimes.length,
    ready: runtimes.filter((runtime) => runtime.status === "READY").length,
    degraded: runtimes.filter((runtime) => runtime.status === "DEGRADED").length,
    unavailable: runtimes.filter((runtime) => runtime.status === "UNAVAILABLE").length,
    unverified: runtimes.filter((runtime) => runtime.status === "UNVERIFIED").length,
    checksPassed: checks.filter((check) => check === "PASS").length,
    checksFailed: checks.filter((check) => check === "FAIL").length,
    checksNotRun: checks.filter((check) => check === "NOT_RUN").length,
  };
}

export async function runDoctor(options: RunDoctorOptions): Promise<DoctorReport> {
  const started = performance.now();
  const probes = await Promise.all(options.adapters.map(async (adapter) => {
    try {
      return { adapter, probe: await adapter.probe() };
    } catch (error) {
      return {
        adapter,
        probe: {
          runtime: adapter.id,
          status: "UNEXECUTABLE" as const,
          command: adapter.id,
          version: null,
          diagnostic: redactText((error as Error).message),
        },
      };
    }
  }));
  const runtimes: DoctorRuntimeResult[] = [];

  for (const { adapter, probe } of probes) {
    if (probe.status !== "AVAILABLE") {
      runtimes.push(probeResult(adapter, probe));
      continue;
    }

    if (!options.live) {
      runtimes.push({
        runtime: adapter.id,
        displayName: adapter.displayName,
        status: "UNVERIFIED",
        version: probe.version,
        durationMs: 0,
        probeStatus: probe.status,
        canary: null,
        checks: allChecks("PASS", "NOT_RUN", "PASS"),
        findings: [finding(
          "LIVE_CHECK_NOT_RUN",
          "runtime",
          "Executable discovery passed; end-to-end tool use was not tested.",
          "Rerun doctor with --live to verify a real task and deterministic evidence.",
        )],
      });
      continue;
    }

    if (!adapter.createInvocation) {
      runtimes.push({
        runtime: adapter.id,
        displayName: adapter.displayName,
        status: "UNVERIFIED",
        version: probe.version,
        durationMs: 0,
        probeStatus: probe.status,
        canary: null,
        checks: allChecks("PASS", "NOT_RUN", "PASS"),
        findings: [finding(
          "LIVE_CHECK_UNSUPPORTED",
          "runtime",
          "This adapter supports discovery but not live task execution yet.",
          "Use probe results only or contribute a deterministic invocation adapter.",
        )],
      });
      continue;
    }

    const secret = options.simulation === "secret" ? "doctor-secret-value-12345" : undefined;
    const canary = await (options.runTest ?? runRuntimeTest)(adapter, {
      timeoutMs: options.timeoutMs,
      simulation: options.simulation,
      secret,
    });
    runtimes.push(liveResult(adapter, probe, canary));
  }

  return {
    schemaVersion: 1,
    mode: options.live ? "live" : "probe",
    generatedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
    summary: summarize(runtimes),
    runtimes,
  };
}

export const doctorInternals = { classifyFailure };
