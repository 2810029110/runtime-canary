import spawn from "cross-spawn";
import type { ProbeResult } from "./domain/types.ts";

interface ProbeOptions {
  runtime: string;
  command: string;
  args?: string[];
  timeoutMs?: number;
}

function launchErrorStatus(error: NodeJS.ErrnoException): "NOT_INSTALLED" | "UNEXECUTABLE" {
  return error.code === "ENOENT" ? "NOT_INSTALLED" : "UNEXECUTABLE";
}

export async function probeExecutable(options: ProbeOptions): Promise<ProbeResult> {
  const args = options.args ?? ["--version"];
  const timeoutMs = options.timeoutMs ?? 3_000;

  return await new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (result: ProbeResult): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(options.command, args, {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const launchError = error as NodeJS.ErrnoException;
      finish({
        runtime: options.runtime,
        status: launchErrorStatus(launchError),
        command: options.command,
        version: null,
        diagnostic: launchError.message,
      });
      return;
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });

    child.once("error", (error: NodeJS.ErrnoException) => {
      finish({
        runtime: options.runtime,
        status: launchErrorStatus(error),
        command: options.command,
        version: null,
        diagnostic: error.message,
      });
    });

    child.once("close", (code) => {
      const output = `${stdout}\n${stderr}`.trim();
      finish({
        runtime: options.runtime,
        status: code === 0 ? "AVAILABLE" : "UNEXECUTABLE",
        command: options.command,
        version: code === 0 ? output.split(/\r?\n/, 1)[0] || "unknown" : null,
        diagnostic: code === 0 ? null : output || `Version probe exited with code ${code}.`,
      });
    });

    timer = setTimeout(() => {
      child.kill();
      finish({
        runtime: options.runtime,
        status: "UNEXECUTABLE",
        command: options.command,
        version: null,
        diagnostic: `Version probe timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);
    timer.unref();
  });
}

export const probeInternals = { launchErrorStatus };
