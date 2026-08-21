#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (exitCode) => resolveRun({ exitCode, stdout, stderr }));
  });
}

const root = await mkdtemp(join(tmpdir(), "runtime-canary-package-"));
const packageDir = join(root, "package");
const installDir = join(root, "install");

try {
  await mkdir(packageDir, { recursive: true });
  const packed = await run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination", packageDir,
  ]);
  assert.equal(packed.exitCode, 0, packed.stderr);
  const packResult = JSON.parse(packed.stdout)[0];
  const paths = packResult.files.map((item) => item.path);
  for (const required of [
    "package.json",
    "dist/cli.js",
    "scripts/fake-runtime.mjs",
    "schemas/doctor-result.schema.json",
  ]) {
    assert.ok(paths.includes(required), `tarball is missing ${required}`);
  }
  assert.equal(paths.some((path) => path.startsWith("tests/")), false);
  assert.equal(paths.some((path) => path.startsWith("node_modules/")), false);

  const archivePath = resolve(packageDir, packResult.filename);
  const installed = await run("npm", [
    "install",
    "--prefix", installDir,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    archivePath,
  ]);
  assert.equal(installed.exitCode, 0, installed.stderr);

  const executable = join(
    installDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "runtime-canary.cmd" : "runtime-canary",
  );
  const smoke = await run(executable, [
    "doctor",
    "--runtime", "fake",
    "--live",
    "--json",
  ], { cwd: installDir });
  assert.equal(smoke.exitCode, 0, smoke.stderr);
  const report = JSON.parse(smoke.stdout);
  assert.equal(report.summary.ready, 1);
  assert.equal(report.summary.checksPassed, 5);
  assert.equal(report.runtimes[0].canary.cleaned, true);
  console.log(`package smoke passed (${packResult.size} bytes, ${paths.length} files)`);
} finally {
  await rm(root, { recursive: true, force: true });
}
