#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import spawn from "cross-spawn";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(projectRoot, "src", "cli.ts");
const expectedPath = join(projectRoot, "docs", "demo-output.txt");

async function run(args, expectedCode) {
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== expectedCode) {
        reject(new Error(`Command exited with ${code}; expected ${expectedCode}.\n${stderr}`));
        return;
      }
      resolve(stdout.trim().replace(/duration: \d+ms/g, "duration: <measured>"));
    });
  });
}

const scenarios = [
  { label: "runtime-canary probe --runtime fake", args: ["probe", "--runtime", "fake"], code: 0 },
  { label: "runtime-canary test --runtime fake", args: ["test", "--runtime", "fake"], code: 0 },
  {
    label: "runtime-canary test --runtime fake --simulate timeout --timeout 350",
    args: ["test", "--runtime", "fake", "--simulate", "timeout", "--timeout", "350"],
    code: 1,
  },
];

const sections = [];
for (const scenario of scenarios) {
  sections.push(`$ ${scenario.label}\n${await run(scenario.args, scenario.code)}`);
}
const output = `${sections.join("\n\n")}\n`.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
  const expected = (await readFile(expectedPath, "utf8")).replace(/\r\n/g, "\n");
  if (output !== expected) {
    console.error("docs/demo-output.txt is stale. Run `npm run demo` and update it.");
    process.exitCode = 1;
  } else {
    console.log("demo output is current");
  }
} else {
  process.stdout.write(output);
}
