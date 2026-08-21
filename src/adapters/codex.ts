import { probeExecutable } from "../probe.ts";
import type { ProbeResult, RuntimeAdapter } from "../domain/types.ts";

export class CodexRuntimeAdapter implements RuntimeAdapter {
  readonly id = "codex";
  readonly displayName = "Codex";

  async probe(): Promise<ProbeResult> {
    return await probeExecutable({
      runtime: this.id,
      command: "codex",
      args: ["--version"],
    });
  }
}
