import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli.ts";

test("unknown runtime returns a usage error", async () => {
  const originalError = console.error;
  const messages: string[] = [];
  console.error = (...values) => { messages.push(values.join(" ")); };
  try {
    const code = await main(["probe", "--runtime", "unknown"]);
    assert.equal(code, 2);
    assert.match(messages.join("\n"), /Unknown runtime/);
  } finally {
    console.error = originalError;
  }
});

test("test --json emits a complete machine-readable result", async () => {
  const originalLog = console.log;
  const messages: string[] = [];
  console.log = (...values) => { messages.push(values.join(" ")); };
  try {
    const code = await main(["test", "--runtime", "fake", "--json"]);
    assert.equal(code, 0);
    const result = JSON.parse(messages.join("\n")) as {
      status: string;
      evidence: { tokenMatched: boolean };
      isolation: { cleaned: boolean };
    };
    assert.equal(result.status, "PASS");
    assert.equal(result.evidence.tokenMatched, true);
    assert.equal(result.isolation.cleaned, true);
  } finally {
    console.log = originalLog;
  }
});

test("doctor --live emits the five-layer machine-readable result", async () => {
  const originalLog = console.log;
  const messages: string[] = [];
  console.log = (...values) => { messages.push(values.join(" ")); };
  try {
    const code = await main(["doctor", "--runtime", "fake", "--live", "--json"]);
    assert.equal(code, 0);
    const report = JSON.parse(messages.join("\n")) as {
      mode: string;
      summary: { ready: number; checksPassed: number };
      runtimes: Array<{ checks: Record<string, string> }>;
    };
    assert.equal(report.mode, "live");
    assert.equal(report.summary.ready, 1);
    assert.equal(report.summary.checksPassed, 5);
    assert.deepEqual(Object.values(report.runtimes[0].checks), Array(5).fill("PASS"));
  } finally {
    console.log = originalLog;
  }
});

test("doctor writes a shareable Markdown report without changing JSON output", async () => {
  const root = await mkdtemp(join(tmpdir(), "runtime-canary-report-test-"));
  const reportPath = join(root, "nested", "doctor.md");
  const originalLog = console.log;
  const originalError = console.error;
  const messages: string[] = [];
  console.log = (...values) => { messages.push(values.join(" ")); };
  console.error = () => {};
  try {
    const code = await main([
      "doctor",
      "--runtime", "fake",
      "--live",
      "--json",
      "--report", reportPath,
    ]);
    assert.equal(code, 0);
    assert.equal(JSON.parse(messages.join("\n")).summary.ready, 1);
    const markdown = await readFile(reportPath, "utf8");
    assert.match(markdown, /^# Runtime Canary Doctor/m);
    assert.match(markdown, /All requested checks passed\./);
    assert.doesNotMatch(markdown, /runtime-canary-report-test-/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    await rm(root, { recursive: true, force: true });
  }
});

test("--report is rejected outside doctor", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await main(["probe", "--runtime", "fake", "--report", "result.md"]), 2);
  } finally {
    console.error = originalError;
  }
});
