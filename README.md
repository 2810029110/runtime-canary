# Runtime Canary

[![CI](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml/badge.svg)](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2f855a.svg)](LICENSE)

## 🔎 超越 `--version`

**一条命令，验证你的 Coding Agent 真的能工作。**

版本号只能证明程序能够启动，却无法告诉你认证是否过期、网络是否受阻、
沙箱能否写入，以及 Agent 是否真的调用了工具。Runtime Canary 通过五层确定性
检查，把“应该能用”变成可以检查、分享和采取行动的证据。

| 你真正想知道的 | 普通 `--version` | Runtime Canary `doctor --live` |
| --- | :---: | :---: |
| 可执行文件能否启动？ | ✅ | ✅ |
| Agent 能否完成真实任务？ | ❓ 未验证 | ✅ 已验证 |
| 工具是否生成了指定证据？ | ❓ 未验证 | ✅ 已验证 |
| 隔离工作区是否清理完成？ | ❓ 未验证 | ✅ 已验证 |

```text
$ npm run doctor -- --runtime fake --live
1 ready | 0 degraded | 0 unavailable | 0 unverified
checks: 5 passed | 0 failed | 0 not run
[+] Deterministic fake runtime: READY
```

> [!IMPORTANT]
> **能力边界：**Runtime Canary 只检测你已有的 CLI 安装和现有认证状态；
> 不安装 Agent CLI、不管理凭据，也不执行 Claude、Codex 或 Gemini 登录。
> 当前覆盖：Codex（live canary）、Claude Code（仅 probe）。

## ⚡ 快速开始

```bash
git clone https://github.com/2810029110/runtime-canary.git
cd runtime-canary
npm install
npm run doctor
```

默认 Doctor 会免费检查真实 adapter 的可执行文件和版本。指定 runtime 并加入
`--live`，即可运行完整 Canary：

```bash
npm run doctor -- --runtime codex --live --timeout 120000
npm run doctor -- --runtime fake --live
```

> [!NOTE]
> `--live` 可能通过 runtime 的现有认证发起真实模型请求，并消耗套餐额度或
> API 用量。

## Five layers, one result

The live doctor creates an isolated workspace, gives the runtime a random token,
asks it to write deterministic JSON through its own tools, verifies the file,
then removes the workspace and any timed-out process tree.

| Capability | `--version` | Doctor probe | Doctor `--live` |
| --- | :---: | :---: | :---: |
| Discover executable | Yes | Yes | Yes |
| Launch runtime | Yes | Yes | Yes |
| Complete an agent task | No | No | Yes |
| Produce verified tool evidence | No | No | Yes |
| Prove isolation cleanup | No | No | Yes |

That expands a normal version check from two observable layers to five. A
successful exit without the expected evidence is still a failure: 2.5x as many
observable checkpoints as `--version` alone.

## Actionable findings

Doctor translates runtime output into stable categories and recommended next
steps:

| Finding | What it distinguishes |
| --- | --- |
| `RUNTIME_NOT_INSTALLED` | Missing executable instead of a broken runtime |
| `RUNTIME_UNEXECUTABLE` | PATH, permission, or platform launch failure |
| `AUTHENTICATION_FAILED` | Rejected or unavailable credential |
| `NETWORK_FAILED` | DNS, TLS, proxy, firewall, or connection failure |
| `PERMISSION_FAILED` | Sandbox, approval, or workspace write failure |
| `CONFIGURATION_FAILED` | Config, MCP, plugin, or hook startup failure |
| `RUNTIME_TIMEOUT` | A runtime or child process that never completes |
| `EVIDENCE_MISSING` | Successful exit without the requested tool result |
| `CLEANUP_FAILED` | Files or child processes survived isolation cleanup |

Example:

```text
[!] Codex: DEGRADED (codex-cli 0.x)
  authentication: The runtime started, but its credential was rejected or unavailable.
  next: Refresh the runtime's supported credential source, then rerun the live check.
```

## Commands

Check every real adapter without making model requests:

```bash
npm run doctor
```

Check one runtime end to end:

```bash
npm run doctor -- --runtime codex --live --timeout 120000
```

Use JSON for CI, issue reports, or another UI:

```bash
npm run doctor -- --runtime codex --live --json
```

Write a shareable Markdown report while keeping the normal terminal or JSON
output:

```bash
npm run doctor -- --runtime codex --live --report artifacts/codex-doctor.md
```

Doctor JSON is share-oriented: it contains versions, check states, deterministic
evidence, and actions, but omits raw runtime output and local workspace paths.
The Markdown report applies the same boundary and is ready to attach to an issue
or CI artifact. Use the lower-level `test --json` command when private debugging
needs redacted stdout and stderr.

Run the lower-level probe and test contracts directly:

```bash
npm run canary -- probe --runtime codex
npm run canary -- test --runtime fake
```

## Adapter coverage

| Runtime | Discovery | Live canary |
| --- | :---: | :---: |
| Deterministic control | Built in | Built in |
| Codex | Built in | Built in |
| Claude Code | Built in | Probe only |

Adapters own only executable discovery and the runtime-specific invocation.
Timeouts, process-tree termination, output capture, redaction, deterministic
evidence, classification, and cleanup stay shared.

See [the adapter authoring guide](docs/adapter-authoring.md) to add another
coding-agent runtime.

## Codex authentication isolation

Runtime Canary uses an empty `CODEX_HOME` by default. When a Codex credential is
stored in a specific home, point the adapter at it explicitly:

```powershell
$env:RUNTIME_CANARY_CODEX_HOME = "$env:USERPROFILE\.codex"
$env:RUNTIME_CANARY_CODEX_COMMAND = "C:\path\to\codex.exe"
npm run doctor -- --runtime codex --live --timeout 120000
```

The command override is optional when `codex` already resolves to an executable.
The adapter runs `codex exec` with an ephemeral session, ignores user config and
rules, and requests a workspace-write sandbox.

## Deterministic development

No paid account is required to develop the harness. The bundled control runtime
reproduces success, authentication, network, permission, configuration/MCP,
startup, missing-evidence, secret-output, and full process-tree timeout paths:

```bash
npm run doctor -- --runtime fake --live
npm run doctor -- --runtime fake --live --simulate authentication
npm run doctor -- --runtime fake --live --simulate network
npm run doctor -- --runtime fake --live --simulate permission
npm run doctor -- --runtime fake --live --simulate configuration
npm run doctor -- --runtime fake --live --simulate missing-evidence
npm run doctor -- --runtime fake --live --simulate timeout --timeout 350
npm run canary -- test --runtime fake --simulate startup-failure
npm run canary -- test --runtime fake --simulate secret --json
```

Run the complete local verification:

```bash
npm test
npm run demo:check
npm run package:check
npm audit --omit=dev
```

`package:check` builds the npm tarball, installs it into a temporary directory,
runs the packaged CLI through npm's generated executable, verifies all five
live layers, and removes the temporary installation. It does not publish.

## Safety model

Every live test receives isolated home, config, app-data, project, and temporary
directories. Runtime output is redacted before it reaches terminal or JSON
results. Timeouts terminate the full process tree, including on Windows, and
every result reports whether cleanup succeeded.

This is repeatable process isolation, not a security sandbox. Do not use it to
run untrusted code.

## Architecture

- `RuntimeAdapter` translates one agent CLI into the shared contract.
- `runRuntimeTest` owns the deterministic canary lifecycle.
- `runDoctor` adds cross-runtime orchestration and actionable classification.
- `CanaryVerifier` validates file evidence independently of runtime output.
- JSON results follow [the doctor report schema](schemas/doctor-result.schema.json)
  and keep CI or future interfaces independent of terminal formatting.

## License

MIT
