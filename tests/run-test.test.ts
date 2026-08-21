import test from "node:test";
import assert from "node:assert/strict";
import { access, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { FakeRuntimeAdapter } from "../src/adapters/fake.ts";
import { runRuntimeTest } from "../src/run-test.ts";
import { createIsolatedWorkspace } from "../src/workspace.ts";
import type { RuntimeAdapter } from "../src/domain/types.ts";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function directorySnapshot(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const snapshot: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const itemPath = join(path, entry.name);
    const metadata = await stat(itemPath);
    snapshot.push(`${entry.name}:${entry.isDirectory() ? "d" : "f"}:${metadata.size}`);
  }
  return snapshot;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("successful fake run passes its canary and cleans isolation", async () => {
  const result = await runRuntimeTest(new FakeRuntimeAdapter());
  assert.equal(result.status, "PASS");
  assert.equal(result.evidence?.tokenMatched, true);
  assert.equal(result.isolation.cleaned, true);
  assert.equal(await exists(result.isolation.workspaceRoot), false);
});

test("startup failure is distinct from an assertion failure", async () => {
  const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
    simulation: "startup-failure",
  });
  assert.equal(result.status, "RUNTIME_DEGRADED");
  assert.equal(result.exitCode, 17);
  assert.equal(result.evidence, null);
  assert.equal(result.isolation.cleaned, true);
});

for (const [simulation, exitCode] of [
  ["authentication", 18],
  ["network", 19],
  ["permission", 20],
  ["configuration", 21],
] as const) {
  test(`${simulation} fixture exits deterministically and cleans isolation`, async () => {
    const result = await runRuntimeTest(new FakeRuntimeAdapter(), { simulation });
    assert.equal(result.status, "RUNTIME_DEGRADED");
    assert.equal(result.exitCode, exitCode);
    assert.equal(result.isolation.cleaned, true);
  });
}

test("missing-evidence fixture completes without writing the canary", async () => {
  const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
    simulation: "missing-evidence",
  });
  assert.equal(result.status, "ASSERTION_FAILED");
  assert.equal(result.exitCode, 0);
  assert.equal(result.evidence?.observed, false);
  assert.equal(result.isolation.cleaned, true);
});

test("missing canary evidence is an assertion failure and cleans isolation", async () => {
  const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
    verifier: {
      async verify(_projectDir, spec) {
        return {
          path: spec.relativePath,
          observed: false,
          tokenMatched: false,
        };
      },
    },
  });

  assert.equal(result.status, "ASSERTION_FAILED");
  assert.equal(result.exitCode, 0);
  assert.equal(result.evidence?.observed, false);
  assert.equal(result.isolation.cleaned, true);
  assert.equal(await exists(result.isolation.workspaceRoot), false);
});

test("secrets are redacted before returning a result", async () => {
  const secret = "doctor-secret-value-12345";
  const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
    simulation: "secret",
    secret,
  });
  const serialized = JSON.stringify(result);
  assert.equal(result.status, "PASS");
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(result.stdout, /\[REDACTED\]/);
});

test("timeout kills the full process tree and cleans isolation", async () => {
  const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
    simulation: "timeout",
    timeoutMs: 350,
  });
  assert.equal(result.status, "TIMEOUT");
  assert.equal(result.timedOut, true);
  assert.equal(result.isolation.cleaned, true);

  const pidMatch = result.stdout.match(/GRANDCHILD_PID=(\d+)/);
  assert.ok(pidMatch, "fake runtime must report the grandchild PID");
  const grandchildPid = Number(pidMatch[1]);
  await delay(100);
  assert.equal(isProcessAlive(grandchildPid), false, `grandchild ${grandchildPid} is still alive`);
});

test("a run does not write into the source workspace", async () => {
  const before = await directorySnapshot(process.cwd());
  const result = await runRuntimeTest(new FakeRuntimeAdapter());
  const after = await directorySnapshot(process.cwd());
  assert.equal(result.status, "PASS");
  assert.deepEqual(after, before);
});

test("an adapter may build its invocation asynchronously", async () => {
  const fake = new FakeRuntimeAdapter();
  const adapter: RuntimeAdapter = {
    id: "async-fake",
    displayName: "Async fake runtime",
    probe: () => fake.probe(),
    async createInvocation(context) {
      await delay(1);
      return fake.createInvocation(context);
    },
  };

  const result = await runRuntimeTest(adapter);
  assert.equal(result.status, "PASS");
  assert.equal(result.isolation.cleaned, true);
});

test("a probe-only adapter returns a structured harness error", async () => {
  const adapter: RuntimeAdapter = {
    id: "probe-only",
    displayName: "Probe-only runtime",
    async probe() {
      return {
        runtime: "probe-only",
        status: "AVAILABLE",
        command: "probe-only",
        version: "1.0.0",
        diagnostic: null,
      };
    },
  };

  const result = await runRuntimeTest(adapter);
  assert.equal(result.status, "HARNESS_ERROR");
  assert.match(result.diagnostic ?? "", /does not implement test execution/);
  assert.equal(result.isolation.cleaned, true);
});

test("cleanup failure preserves evidence, reports the failure, and redacts it", async () => {
  const workspace = await createIsolatedWorkspace();
  const dispose = workspace.dispose;
  const secret = "cleanup-secret-value-67890";

  try {
    const result = await runRuntimeTest(new FakeRuntimeAdapter(), {
      secret,
      workspaceFactory: async () => ({
        ...workspace,
        async dispose() {
          throw new Error(`could not remove ${secret}`);
        },
      }),
    });

    assert.equal(result.status, "PASS");
    assert.equal(result.evidence?.tokenMatched, true);
    assert.equal(result.isolation.cleaned, false);
    assert.match(result.diagnostic ?? "", /Workspace cleanup failed/);
    assert.match(result.diagnostic ?? "", /\[REDACTED\]/);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
  } finally {
    await dispose();
    await rm(workspace.root, { recursive: true, force: true });
  }
});
