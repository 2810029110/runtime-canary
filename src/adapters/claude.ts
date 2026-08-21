import { probeExecutable } from "../probe.ts";
import type { ProbeResult, RuntimeAdapter } from "../domain/types.ts";

export class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly id = "claude";
  readonly displayName = "Claude Code";

  async probe(): Promise<ProbeResult> {
    return await probeExecutable({
      runtime: this.id,
      command: "claude",
      args: ["--version"],
    });
  }
}
