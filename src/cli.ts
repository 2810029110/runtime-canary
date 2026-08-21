#!/usr/bin/env node

import { getRuntimeAdapter, runtimeIds } from "./adapters/registry.ts";
import { formatProbe, formatTest } from "./reporters.ts";
import { runRuntimeTest } from "./run-test.ts";

interface ParsedArgs {
  command?: string;
  runtime: string;
  json: boolean;
  simulation: "success" | "timeout" | "startup-failure" | "secret";
  timeoutMs: number;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseArgs(args: string[]): ParsedArgs {
  const simulation = valueAfter(args, "--simulate") ?? "success";
  if (!["success", "timeout", "startup-failure", "secret"].includes(simulation)) {
    throw new Error(`Unknown simulation '${simulation}'.`);
  }

  const timeoutMs = Number(valueAfter(args, "--timeout") ?? "5000");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 50) {
    throw new Error("--timeout must be a number of at least 50ms.");
  }

  return {
    command: args[0],
    runtime: valueAfter(args, "--runtime") ?? "fake",
    json: args.includes("--json"),
    simulation: simulation as ParsedArgs["simulation"],
    timeoutMs,
  };
}

function usage(): string {
  return [
    "Runtime Canary",
    "",
    "Usage:",
    "  runtime-canary probe --runtime <fake|claude|codex> [--json]",
    "  runtime-canary test --runtime fake [--simulate <mode>] [--timeout <ms>] [--json]",
    "",
    "Simulation modes: success, timeout, startup-failure, secret",
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

  const adapter = getRuntimeAdapter(options.runtime);
  if (!adapter) {
    console.error(`Unknown runtime '${options.runtime}'. Available: ${runtimeIds().join(", ")}`);
    return 2;
  }

  if (options.command === "probe") {
    const result = await adapter.probe();
    console.log(options.json ? JSON.stringify(result, null, 2) : formatProbe(result));
    return result.status === "AVAILABLE" ? 0 : 1;
  }

  if (options.command === "test") {
    const probe = await adapter.probe();
    if (probe.status !== "AVAILABLE") {
      console.log(options.json ? JSON.stringify(probe, null, 2) : formatProbe(probe));
      return 1;
    }
    const secret = options.simulation === "secret" ? "doctor-secret-value-12345" : undefined;
    const result = await runRuntimeTest(adapter, {
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
