import type { ChildProcess } from "node:child_process";
import spawn from "cross-spawn";
import { redactText } from "./redaction.ts";
import type { ProcessResult, RuntimeInvocation } from "./domain/types.ts";

interface RunOptions {
  cwd: string;
  env: Record<string, string | undefined>;
  timeoutMs: number;
  secrets?: string[];
}

async function waitForProcess(child: ChildProcess): Promise<number | null> {
  return await new Promise((resolve) => {
    child.once("error", () => resolve(null));
    child.once("close", (code) => resolve(code));
  });
}

export async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid) return;

  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    const code = await waitForProcess(killer);
    if (code !== 0 && child.exitCode === null) child.kill("SIGKILL");
    return;
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

export async function runProcess(
  invocation: RuntimeInvocation,
  options: RunOptions,
): Promise<ProcessResult> {
  const started = performance.now();
  let stdout = "";
  let stderr = "";
  let launchError: string | null = null;
  let timedOut = false;
  let signal: string | null = null;
  let exitCode: number | null = null;

  const childEnv = {
    ...process.env,
    ...options.env,
    ...invocation.env,
  };

  let child: ChildProcess;
  try {
    child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: childEnv,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    launchError = (error as Error).message;
    return {
      exitCode,
      signal,
      timedOut,
      durationMs: performance.now() - started,
      stdout: "",
      stderr: "",
      launchError: redactText(launchError, options.secrets),
    };
  }

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => { stdout += chunk; });
  child.stderr?.on("data", (chunk) => { stderr += chunk; });

  const completed = new Promise<void>((resolve) => {
    child.once("error", (error) => {
      launchError = error.message;
    });
    child.once("close", (code, closeSignal) => {
      exitCode = code;
      signal = closeSignal;
      resolve();
    });
  });

  let terminationPromise: Promise<void> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    terminationPromise = terminateProcessTree(child).catch((error) => {
      launchError = `Failed to terminate timed-out process tree: ${(error as Error).message}`;
      try {
        child.kill("SIGKILL");
      } catch {
        // The process may already have exited at the timeout boundary.
      }
    });
  }, options.timeoutMs);
  timer.unref();

  await completed;
  clearTimeout(timer);
  await terminationPromise;

  return {
    exitCode,
    signal,
    timedOut,
    durationMs: performance.now() - started,
    stdout: redactText(stdout, options.secrets),
    stderr: redactText(stderr, options.secrets),
    launchError: launchError ? redactText(launchError, options.secrets) : null,
  };
}
