import test from "node:test";
import assert from "node:assert/strict";
import { formatDoctorMarkdown } from "../src/reporters.ts";
import type { DoctorReport } from "../src/domain/types.ts";

test("Markdown doctor reports escape tables and omit private diagnostics", () => {
  const report: DoctorReport = {
    schemaVersion: 1,
    mode: "live",
    generatedAt: "2026-08-21T00:00:00.000Z",
    durationMs: 42.4,
    summary: {
      total: 1,
      ready: 0,
      degraded: 1,
      unavailable: 0,
      unverified: 0,
      checksPassed: 3,
      checksFailed: 1,
      checksNotRun: 1,
    },
    runtimes: [{
      runtime: "fixture",
      displayName: "Fixture | runtime",
      status: "DEGRADED",
      version: "1.0 | test",
      durationMs: 40,
      probeStatus: "AVAILABLE",
      canary: {
        status: "RUNTIME_DEGRADED",
        durationMs: 40,
        exitCode: 1,
        timedOut: false,
        evidence: null,
        cleaned: true,
      },
      checks: {
        discovery: "PASS",
        launch: "PASS",
        task: "FAIL",
        evidence: "NOT_RUN",
        cleanup: "PASS",
      },
      findings: [{
        code: "AUTHENTICATION_FAILED",
        category: "authentication",
        summary: "Credential rejected.",
        action: "Refresh authentication.",
      }],
    }],
  };

  const markdown = formatDoctorMarkdown(report);
  assert.match(markdown, /Fixture \\| runtime/);
  assert.match(markdown, /AUTHENTICATION_FAILED/);
  assert.match(markdown, /omits raw process output/);
  assert.doesNotMatch(markdown, /stderr|C:\\Users|runtime-canary-[a-z0-9-]+\\project/i);
});
