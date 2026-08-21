import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { probeExecutable, probeInternals } from "../src/probe.ts";
import { FakeRuntimeAdapter } from "../src/adapters/fake.ts";

test("fake runtime probe is available", async () => {
  const result = await new FakeRuntimeAdapter().probe();
  assert.equal(result.status, "AVAILABLE");
  assert.match(result.version ?? "", /runtime-canary-fake/);
});

test("missing command is classified as NOT_INSTALLED", async () => {
  const result = await probeExecutable({
    runtime: "missing",
    command: `runtime-canary-command-that-does-not-exist-${Date.now()}`,
    timeoutMs: 500,
  });
  assert.equal(result.status, "NOT_INSTALLED");
});

test("permission failures are classified as UNEXECUTABLE", () => {
  const error = Object.assign(new Error("access denied"), { code: "EACCES" });
  assert.equal(probeInternals.launchErrorStatus(error), "UNEXECUTABLE");
});

test("Windows command shims can be probed without shell mode", {
  skip: process.platform !== "win32",
}, async () => {
  const root = await mkdtemp(join(tmpdir(), "runtime-canary-shim-"));
  const shim = join(root, "runtime-canary-test.cmd");
  try {
    await writeFile(shim, "@echo off\r\necho runtime-canary-shim 1.0.0\r\n", "utf8");
    const result = await probeExecutable({
      runtime: "shim",
      command: shim,
    });
    assert.equal(result.status, "AVAILABLE");
    assert.equal(result.version, "runtime-canary-shim 1.0.0");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
