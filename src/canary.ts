import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CanaryEvidence, CanarySpec, CanaryVerifier } from "./domain/types.ts";

export class FileCanaryVerifier implements CanaryVerifier {
  async verify(projectDir: string, spec: CanarySpec): Promise<CanaryEvidence> {
    const path = join(projectDir, spec.relativePath);
    try {
      const payload = JSON.parse(await readFile(path, "utf8")) as { token?: unknown };
      return {
        path: spec.relativePath,
        observed: true,
        tokenMatched: payload.token === spec.expectedToken,
      };
    } catch {
      return {
        path: spec.relativePath,
        observed: false,
        tokenMatched: false,
      };
    }
  }
}
