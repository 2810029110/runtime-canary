import { ClaudeRuntimeAdapter } from "./claude.ts";
import { CodexRuntimeAdapter } from "./codex.ts";
import { FakeRuntimeAdapter } from "./fake.ts";
import type { RuntimeAdapter } from "../domain/types.ts";

const adapters: RuntimeAdapter[] = [
  new FakeRuntimeAdapter(),
  new ClaudeRuntimeAdapter(),
  new CodexRuntimeAdapter(),
];

export function getRuntimeAdapter(id: string): RuntimeAdapter | undefined {
  return adapters.find((adapter) => adapter.id === id);
}

export function runtimeIds(): string[] {
  return adapters.map((adapter) => adapter.id);
}
