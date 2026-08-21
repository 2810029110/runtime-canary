import { fileURLToPath } from "node:url";
import { probeExecutable } from "../probe.ts";
import type {
  ProbeResult,
  RuntimeAdapter,
  RuntimeContext,
  RuntimeInvocation,
} from "../domain/types.ts";

const scriptPath = fileURLToPath(new URL("../../scripts/fake-runtime.mjs", import.meta.url));

export class FakeRuntimeAdapter implements RuntimeAdapter {
  readonly id = "fake";
  readonly displayName = "Deterministic fake runtime";

  async probe(): Promise<ProbeResult> {
    return await probeExecutable({
      runtime: this.id,
      command: process.execPath,
      args: [scriptPath, "--version"],
    });
  }

  createInvocation(context: RuntimeContext): RuntimeInvocation {
    return {
      command: process.execPath,
      args: [
        scriptPath,
        "--workspace",
        context.projectDir,
        "--canary-token",
        context.canaryToken,
        "--simulate",
        context.simulation,
      ],
      env: context.secret ? { FAKE_SECRET: context.secret } : undefined,
    };
  }
}
