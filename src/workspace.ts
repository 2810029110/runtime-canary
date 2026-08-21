import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface IsolatedWorkspace {
  root: string;
  projectDir: string;
  homeDir: string;
  tempDir: string;
  env: Record<string, string>;
  dispose(): Promise<void>;
}

export async function createIsolatedWorkspace(): Promise<IsolatedWorkspace> {
  const root = await mkdtemp(join(tmpdir(), "runtime-canary-"));
  const projectDir = join(root, "project");
  const homeDir = join(root, "home");
  const xdgDir = join(root, "xdg");
  const tempDir = join(root, "tmp");
  const appDataDir = join(root, "appdata");
  const localAppDataDir = join(root, "local-appdata");
  const claudeDir = join(root, "claude-config");
  const codexDir = join(root, "codex-home");

  await Promise.all([
    mkdir(projectDir, { recursive: true }),
    mkdir(homeDir, { recursive: true }),
    mkdir(xdgDir, { recursive: true }),
    mkdir(tempDir, { recursive: true }),
    mkdir(appDataDir, { recursive: true }),
    mkdir(localAppDataDir, { recursive: true }),
    mkdir(claudeDir, { recursive: true }),
    mkdir(codexDir, { recursive: true }),
  ]);

  return {
    root,
    projectDir,
    homeDir,
    tempDir,
    env: {
      HOME: homeDir,
      USERPROFILE: homeDir,
      XDG_CONFIG_HOME: xdgDir,
      APPDATA: appDataDir,
      LOCALAPPDATA: localAppDataDir,
      CLAUDE_CONFIG_DIR: claudeDir,
      CODEX_HOME: codexDir,
      TMPDIR: tempDir,
      TMP: tempDir,
      TEMP: tempDir,
    },
    async dispose() {
      await rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 75 });
    },
  };
}
