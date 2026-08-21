import test from "node:test";
import assert from "node:assert/strict";
import { runProcess } from "../src/process-runner.ts";
import { createIsolatedWorkspace } from "../src/workspace.ts";

const ISOLATED_KEYS = [
  "HOME",
  "USERPROFILE",
  "XDG_CONFIG_HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "CLAUDE_CONFIG_DIR",
  "CODEX_HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
] as const;

test("the child process receives every isolation environment override", async () => {
  const workspace = await createIsolatedWorkspace();
  try {
    const script = `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(
      ISOLATED_KEYS,
    )}.map((key) => [key, process.env[key]]))))`;
    const result = await runProcess({
      command: process.execPath,
      args: ["-e", script],
    }, {
      cwd: workspace.projectDir,
      env: workspace.env,
      timeoutMs: 2_000,
    });

    assert.equal(result.exitCode, 0);
    const observed = JSON.parse(result.stdout) as Record<string, string>;
    for (const key of ISOLATED_KEYS) {
      assert.equal(observed[key], workspace.env[key], `${key} was not isolated`);
    }
  } finally {
    await workspace.dispose();
  }
});
