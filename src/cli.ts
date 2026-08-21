#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getRuntimeAdapter, runtimeAdapters, runtimeIds } from "./adapters/registry.ts";
import { runDoctor } from "./doctor.ts";
import { SIMULATION_MODES, type SimulationMode } from "./domain/types.ts";
import { formatDoctor, formatDoctorMarkdown, formatProbe, formatTest } from "./reporters.ts";
import { runRuntimeTest } from "./run-test.ts";

interface ParsedArgs {
  command?: string;
  runtime: string;
  json: boolean;
  simulation: SimulationMode;
  timeoutMs: number;
  live: boolean;
  reportPath?: string;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(args: string[]): ParsedArgs {
  const simulation = valueAfter(args, "--simulate") ?? "success";
  if (!SIMULATION_MODES.includes(simulation as SimulationMode)) {
    throw new Error(`Unknown simulation '${simulation}'.`);
  }

  const timeoutMs = Number(valueAfter(args, "--timeout") ?? "5000");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 50) {
    throw new Error("--timeout must be a number of at least 50ms.");
  }

  return {
    command: args[0],
    runtime: valueAfter(args, "--runtime") ?? (args[0] === "doctor" ? "all" : "fake"),
    json: args.includes("--json"),
    simulation: simulation as SimulationMode,
    timeoutMs,
    live: args.includes("--live"),
    reportPath: valueAfter(args, "--report"),
  };
}

function usage(): string {
  return [
    "Runtime Canary",
    "",
    "Usage:",
    "  runtime-canary probe --runtime <fake|claude|codex> [--json]",
    "  runtime-canary test --runtime <fake|codex> [--simulate <mode>] [--timeout <ms>] [--json]",
    "  runtime-canary doctor [--runtime <all|fake|claude|codex>] [--live] [--timeout <ms>] [--json] [--report <path.md>]",
    "",
    `Simulation modes: ${SIMULATION_MODES.join(", ")}`,
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let options: ParsedArgs;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    console.error(usage());
    return 2;
  }

  if (!options.command || options.command === "help" || argv.includes("--help")) {
    console.log(usage());
    return 0;
  }

  const adapter = options.runtime === "all" ? undefined : getRuntimeAdapter(options.runtime);
  if (options.runtime !== "all" && !adapter) {
    console.error(`Unknown runtime '${options.runtime}'. Available: ${runtimeIds().join(", ")}`);
    return 2;
  }
  if (options.runtime === "all" && options.command !== "doctor") {
    console.error("Runtime 'all' is available only for the doctor command.");
    return 2;
  }
  if (options.reportPath && options.command !== "doctor") {
    console.error("--report is available only for the doctor command.");
    return 2;
  }

  if (options.command === "doctor") {
    const selected = options.runtime === "all"
      ? runtimeAdapters().filter((item) => item.id !== "fake")
      : [adapter!];
    const report = await runDoctor({
      adapters: selected,
      live: options.live,
      timeoutMs: options.timeoutMs,
      simulation: options.simulation,
    });
    if (options.reportPath) {
      const reportPath = resolve(options.reportPath);
      try {
        await mkdir(dirname(reportPath), { recursive: true });
        await writeFile(reportPath, formatDoctorMarkdown(report), "utf8");
        console.error(`Markdown report written to ${reportPath}`);
      } catch (error) {
        console.error(`Could not write Markdown report: ${(error as Error).message}`);
        return 2;
      }
    }
    console.log(options.json ? JSON.stringify(report, null, 2) : formatDoctor(report));
    const selectedFailure = report.summary.degraded > 0
      || (options.runtime !== "all" && report.summary.unavailable > 0);
    return selectedFailure ? 1 : 0;
  }

  if (options.command === "probe") {
    const result = await adapter!.probe();
    console.log(options.json ? JSON.stringify(result, null, 2) : formatProbe(result));
    return result.status === "AVAILABLE" ? 0 : 1;
  }

  if (options.command === "test") {
    const probe = await adapter!.probe();
    if (probe.status !== "AVAILABLE") {
      console.log(options.json ? JSON.stringify(probe, null, 2) : formatProbe(probe));
      return 1;
    }
    const secret = options.simulation === "secret" ? "doctor-secret-value-12345" : undefined;
    const result = await runRuntimeTest(adapter!, {
      simulation: options.simulation,
      timeoutMs: options.timeoutMs,
      secret,
    });
    console.log(options.json ? JSON.stringify(result, null, 2) : formatTest(result));
    return result.status === "PASS" && result.isolation.cleaned ? 0 : 1;
  }

  console.error(`Unknown command '${options.command}'.`);
  console.error(usage());
  return 2;
}

if (import.meta.main) {
  process.exitCode = await main();
}
