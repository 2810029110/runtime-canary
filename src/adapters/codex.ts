import { probeExecutable } from "../probe.ts";
import type {
  ProbeResult,
  RuntimeAdapter,
  RuntimeContext,
  RuntimeInvocation,
} from "../domain/types.ts";

interface CodexRuntimeAdapterOptions {
  command?: string;
  authHome?: string;
}

export class CodexRuntimeAdapter implements RuntimeAdapter {
  readonly id = "codex";
  readonly displayName = "Codex";
  private readonly command: string;
  private readonly authHome: string | undefined;

  constructor(options: CodexRuntimeAdapterOptions = {}) {
    this.command = options.command
      ?? process.env.RUNTIME_CANARY_CODEX_COMMAND
      ?? "codex";
    this.authHome = options.authHome
      ?? process.env.RUNTIME_CANARY_CODEX_HOME;
  }

  async probe(): Promise<ProbeResult> {
    return await probeExecutable({
      runtime: this.id,
      command: this.command,
      args: ["--version"],
    });
  }

  createInvocation(context: RuntimeContext): RuntimeInvocation {
    const payload = JSON.stringify({ token: context.canaryToken });
    const prompt = [
      "Use filesystem tools to create .runtime-canary/canary.json in the current working directory.",
      `The file must contain exactly this JSON object: ${payload}`,
      "Do not modify any other file. Verify the file exists, then stop.",
      "Perform the write; do not only describe it.",
    ].join(" ");

    return {
      command: this.command,
      args: [
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--color",
        "never",
        prompt,
      ],
      env: this.authHome ? { CODEX_HOME: this.authHome } : undefined,
    };
  }
}
