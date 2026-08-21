import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { FileCanaryVerifier } from "./canary.ts";
import { runProcess } from "./process-runner.ts";
import { redactText } from "./redaction.ts";
import { createIsolatedWorkspace, type IsolatedWorkspace } from "./workspace.ts";
import type {
  CanaryVerifier,
  RuntimeAdapter,
  TestResult,
  TestStatus,
} from "./domain/types.ts";

export interface RunRuntimeTestOptions {
  simulation?: "success" | "timeout" | "startup-failure" | "secret";
  timeoutMs?: number;
  secret?: string;
  verifier?: CanaryVerifier;
  workspaceFactory?: () => Promise<IsolatedWorkspace>;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runRuntimeTest(
  adapter: RuntimeAdapter,
  options: RunRuntimeTestOptions = {},
): Promise<TestResult> {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const workspace = await (options.workspaceFactory ?? createIsolatedWorkspace)();
  const canaryToken = randomUUID();
  const verifier = options.verifier ?? new FileCanaryVerifier();
  let result: TestResult;

  try {
    if (!adapter.createInvocation) {
      throw new Error(`Runtime '${adapter.id}' does not implement test execution yet.`);
    }

    const invocation = await adapter.createInvocation({
      projectDir: workspace.projectDir,
      canaryToken,
      simulation: options.simulation ?? "success",
      secret: options.secret,
    });
    const processResult = await runProcess(invocation, {
      cwd: workspace.projectDir,
      env: workspace.env,
      timeoutMs: options.timeoutMs ?? 5_000,
      secrets: options.secret ? [options.secret] : [],
    });

    let status: TestStatus;
    let diagnostic: string | null = null;
    let evidence = null;

    if (processResult.timedOut) {
      status = "TIMEOUT";
      diagnostic = [
        `Runtime exceeded the ${options.timeoutMs ?? 5_000}ms timeout.`,
        processResult.launchError,
      ].filter(Boolean).join(" ");
    } else if (processResult.launchError || processResult.exitCode !== 0) {
      status = "RUNTIME_DEGRADED";
      diagnostic = processResult.launchError
        ?? `Runtime exited with code ${processResult.exitCode} before the canary passed.`;
    } else {
      evidence = await verifier.verify(workspace.projectDir, {
        relativePath: ".runtime-canary/canary.json",
        expectedToken: canaryToken,
      });
      status = evidence.observed && evidence.tokenMatched ? "PASS" : "ASSERTION_FAILED";
      if (status === "ASSERTION_FAILED") {
        diagnostic = "The runtime exited successfully but did not produce the expected canary.";
      }
    }

    result = {
      schemaVersion: 1,
      runtime: adapter.id,
      status,
      startedAt,
      durationMs: processResult.durationMs,
      exitCode: processResult.exitCode,
      timedOut: processResult.timedOut,
      stdout: processResult.stdout,
      stderr: processResult.stderr,
      diagnostic,
      evidence,
      isolation: {
        workspaceRoot: workspace.root,
        cleaned: false,
      },
    };
  } catch (error) {
    result = {
      schemaVersion: 1,
      runtime: adapter.id,
      status: "HARNESS_ERROR",
      startedAt,
      durationMs: performance.now() - started,
      exitCode: null,
      timedOut: false,
      stdout: "",
      stderr: "",
      diagnostic: redactText(
        (error as Error).message,
        options.secret ? [options.secret] : [],
      ),
      evidence: null,
      isolation: {
        workspaceRoot: workspace.root,
        cleaned: false,
      },
    };
  } finally {
    try {
      await workspace.dispose();
    } catch (error) {
      const cleanupDiagnostic = `Workspace cleanup failed: ${redactText(
        (error as Error).message,
        options.secret ? [options.secret] : [],
      )}`;
      result.diagnostic = [result.diagnostic, cleanupDiagnostic].filter(Boolean).join(" ");
    }
  }

  result.isolation.cleaned = !(await pathExists(workspace.root));
  return result;
}
