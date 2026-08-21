#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function option(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (process.argv.includes("--version")) {
  console.log("runtime-canary-fake 1.0.0");
  process.exit(0);
}

const workspace = option("--workspace");
const token = option("--canary-token");
const simulation = option("--simulate", "success");

if (!workspace || !token) {
  console.error("Missing --workspace or --canary-token.");
  process.exit(2);
}

if (simulation === "startup-failure") {
  console.error("Fake runtime could not load its skill registry.");
  process.exit(17);
}

if (simulation === "timeout") {
  const grandchild = spawn(process.execPath, [
    "-e",
    "setInterval(() => {}, 1000)",
  ], {
    windowsHide: true,
    stdio: "ignore",
  });
  console.log(`GRANDCHILD_PID=${grandchild.pid}`);
  setInterval(() => {}, 1_000);
} else {
  if (simulation === "secret") {
    console.log(`Authorization: Bearer ${process.env.FAKE_SECRET ?? "missing-secret"}`);
  }

  const outputDir = join(workspace, ".runtime-canary");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, "canary.json"),
    `${JSON.stringify({ token, runtime: "fake" }, null, 2)}\n`,
    "utf8",
  );
  console.log("CANARY_WRITTEN");
}
