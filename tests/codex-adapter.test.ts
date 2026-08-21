import test from "node:test";
import assert from "node:assert/strict";
import { CodexRuntimeAdapter } from "../src/adapters/codex.ts";

test("Codex invocation is non-interactive, ephemeral, and workspace-scoped", () => {
  const adapter = new CodexRuntimeAdapter({
    command: "C:\\tools\\codex.exe",
    authHome: "C:\\auth-only",
  });
  const invocation = adapter.createInvocation({
    projectDir: "C:\\isolated-project",
    canaryToken: "canary-token-123",
    simulation: "success",
  });

  assert.equal(invocation.command, "C:\\tools\\codex.exe");
  assert.deepEqual(invocation.args.slice(0, 9), [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "--color",
    "never",
  ]);
  assert.match(invocation.args.at(-1) ?? "", /canary-token-123/);
  assert.deepEqual(invocation.env, { CODEX_HOME: "C:\\auth-only" });
});

test("Codex invocation does not override isolated auth by default", () => {
  const adapter = new CodexRuntimeAdapter({ command: "codex" });
  const invocation = adapter.createInvocation({
    projectDir: "/isolated-project",
    canaryToken: "canary-token-456",
    simulation: "success",
  });

  assert.equal(invocation.env, undefined);
});
