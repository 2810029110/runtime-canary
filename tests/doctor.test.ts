import test from "node:test";
import assert from "node:assert/strict";
import { FakeRuntimeAdapter } from "../src/adapters/fake.ts";
import { runDoctor } from "../src/doctor.ts";
import type { RuntimeAdapter } from "../src/domain/types.ts";

function failingAdapter(message: string): RuntimeAdapter {
  return {
    id: "failing",
    displayName: "Failing runtime",
    async probe() {
      return {
        runtime: "failing",
        status: "AVAILABLE",
        command: process.execPath,
        version: "failing 1.0.0",
        diagnostic: null,
      };
    },
    createInvocation() {
      return {
        command: process.execPath,
        args: ["-e", `console.error(${JSON.stringify(message)});process.exit(1)`],
      };
    },
  };
}

test("live doctor proves task, evidence, and cleanup", async () => {
  const report = await runDoctor({
    adapters: [new FakeRuntimeAdapter()],
    live: true,
  });

  assert.equal(report.summary.ready, 1);
  assert.equal(report.summary.checksPassed, 5);
  assert.equal(report.runtimes[0].status, "READY");
  assert.deepEqual(Object.values(report.runtimes[0].checks), [
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
  ]);
});

test("probe-only doctor is explicit about unverified work", async () => {
  const report = await runDoctor({ adapters: [new FakeRuntimeAdapter()] });

  assert.equal(report.mode, "probe");
  assert.equal(report.summary.unverified, 1);
  assert.equal(report.runtimes[0].findings[0].code, "LIVE_CHECK_NOT_RUN");
});

test("doctor identifies authentication failures", async () => {
  const credential = "sk-testcredential123456789";
  const report = await runDoctor({
    adapters: [failingAdapter(`401 Unauthorized: invalid API key ${credential}`)],
    live: true,
  });

  assert.equal(report.summary.degraded, 1);
  assert.equal(report.runtimes[0].findings[0].code, "AUTHENTICATION_FAILED");
  assert.equal(report.runtimes[0].findings[0].category, "authentication");
  assert.equal(report.runtimes[0].canary?.status, "RUNTIME_DEGRADED");
  assert.doesNotMatch(JSON.stringify(report), new RegExp(credential));
  assert.doesNotMatch(JSON.stringify(report), /invalid API key/i);
});

for (const [label, message, code] of [
  ["network", "WebSocket connection failed behind proxy", "NETWORK_FAILED"],
  ["permissions", "sandbox is read-only: permission denied", "PERMISSION_FAILED"],
  ["configuration", "MCP plugin configuration failed to load", "CONFIGURATION_FAILED"],
] as const) {
  test(`doctor identifies ${label} failures`, async () => {
    const report = await runDoctor({
      adapters: [failingAdapter(message)],
      live: true,
    });

    assert.equal(report.runtimes[0].findings[0].code, code);
  });
}

for (const [simulation, code] of [
  ["authentication", "AUTHENTICATION_FAILED"],
  ["network", "NETWORK_FAILED"],
  ["permission", "PERMISSION_FAILED"],
  ["configuration", "CONFIGURATION_FAILED"],
  ["missing-evidence", "EVIDENCE_MISSING"],
] as const) {
  test(`deterministic ${simulation} scenario produces ${code}`, async () => {
    const report = await runDoctor({
      adapters: [new FakeRuntimeAdapter()],
      live: true,
      simulation,
    });

    assert.equal(report.summary.degraded, 1);
    assert.equal(report.runtimes[0].findings[0].code, code);
    assert.equal(report.runtimes[0].checks.cleanup, "PASS");
  });
}

test("doctor identifies timeout and preserves cleanup proof", async () => {
  const report = await runDoctor({
    adapters: [new FakeRuntimeAdapter()],
    live: true,
    simulation: "timeout",
    timeoutMs: 350,
  });

  assert.equal(report.summary.degraded, 1);
  assert.equal(report.runtimes[0].findings[0].code, "RUNTIME_TIMEOUT");
  assert.equal(report.runtimes[0].checks.cleanup, "PASS");
});

test("missing runtimes are unavailable without pretending they are degraded", async () => {
  const adapter: RuntimeAdapter = {
    id: "missing",
    displayName: "Missing runtime",
    async probe() {
      return {
        runtime: "missing",
        status: "NOT_INSTALLED",
        command: "missing",
        version: null,
        diagnostic: "spawn ENOENT",
      };
    },
  };
  const report = await runDoctor({ adapters: [adapter], live: true });

  assert.equal(report.summary.unavailable, 1);
  assert.equal(report.runtimes[0].findings[0].code, "RUNTIME_NOT_INSTALLED");
});

test("one broken adapter probe does not abort the full doctor report", async () => {
  const broken: RuntimeAdapter = {
    id: "broken",
    displayName: "Broken adapter",
    async probe() {
      throw new Error("adapter exploded");
    },
  };
  const report = await runDoctor({ adapters: [broken, new FakeRuntimeAdapter()] });

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.degraded, 1);
  assert.equal(report.summary.unverified, 1);
  assert.equal(report.runtimes[0].findings[0].code, "RUNTIME_UNEXECUTABLE");
});

test("shareable doctor findings omit local paths from probe diagnostics", async () => {
  const privatePath = "C:\\Users\\example\\private-runtime.exe";
  const adapter: RuntimeAdapter = {
    id: "private-path",
    displayName: "Private path runtime",
    async probe() {
      return {
        runtime: "private-path",
        status: "UNEXECUTABLE",
        command: privatePath,
        version: null,
        diagnostic: `spawn ${privatePath} EPERM`,
      };
    },
  };

  const report = await runDoctor({ adapters: [adapter] });
  assert.equal(report.runtimes[0].findings[0].code, "RUNTIME_UNEXECUTABLE");
  assert.doesNotMatch(JSON.stringify(report), /C:\\\\Users|private-runtime\.exe/);
});

test("successful exit without evidence is classified separately", async () => {
  const adapter = new FakeRuntimeAdapter();
  const report = await runDoctor({
    adapters: [adapter],
    live: true,
    async runTest() {
      return {
        schemaVersion: 1,
        runtime: "fake",
        status: "ASSERTION_FAILED",
        startedAt: new Date().toISOString(),
        durationMs: 10,
        exitCode: 0,
        timedOut: false,
        stdout: "",
        stderr: "",
        diagnostic: "The expected evidence was not produced.",
        evidence: { path: ".runtime-canary/canary.json", observed: false, tokenMatched: false },
        isolation: { workspaceRoot: "isolated", cleaned: true },
      };
    },
  });

  assert.equal(report.runtimes[0].findings[0].code, "EVIDENCE_MISSING");
  assert.equal(report.runtimes[0].checks.task, "PASS");
  assert.equal(report.runtimes[0].checks.evidence, "FAIL");
});
