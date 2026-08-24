# Runtime Canary：让 Coding Agent 超越 `--version`

[English](README.md) | **简体中文**

*在隔离沙箱中运行确定性 Canary，并逐层定位失败原因。*

[![CI](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml/badge.svg)](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2f855a.svg)](LICENSE)

## 🔎 `--version` 远远不够

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

## 🧪 五层检查，一个结论

Live Doctor 会创建隔离工作区，为 runtime 提供随机 token，要求它通过自身工具
写入确定性 JSON，验证文件证据，然后删除工作区及所有超时的进程树。

| 能力 | `--version` | Doctor probe | Doctor `--live` |
| --- | :---: | :---: | :---: |
| 发现可执行文件 | 是 | 是 | 是 |
| 启动 runtime | 是 | 是 | 是 |
| 完成 Agent 任务 | 否 | 否 | 是 |
| 生成经过验证的工具证据 | 否 | 否 | 是 |
| 证明隔离环境已清理 | 否 | 否 | 是 |

普通版本检查只有两个可观测层，Live Doctor 提升到五层。即使进程成功退出，
只要没有产生预期证据，仍然判定为失败。

## 🩺 可操作的故障结论

Doctor 会把 runtime 输出转换成稳定的故障分类和明确的下一步建议：

| Finding | 能区分什么问题 |
| --- | --- |
| `RUNTIME_NOT_INSTALLED` | 未安装，而不是 runtime 损坏 |
| `RUNTIME_UNEXECUTABLE` | PATH、权限或平台启动失败 |
| `AUTHENTICATION_FAILED` | 凭据被拒绝或不可用 |
| `NETWORK_FAILED` | DNS、TLS、代理、防火墙或连接失败 |
| `PERMISSION_FAILED` | 沙箱、审批或工作区写入失败 |
| `CONFIGURATION_FAILED` | 配置、MCP、插件或 Hook 启动失败 |
| `RUNTIME_TIMEOUT` | runtime 或子进程未能结束 |
| `EVIDENCE_MISSING` | 进程成功退出，但没有生成要求的工具证据 |
| `CLEANUP_FAILED` | 隔离文件或子进程清理失败 |

示例：

```text
[!] Codex: DEGRADED (codex-cli 0.x)
  authentication: The runtime started, but its credential was rejected or unavailable.
  next: Refresh the runtime's supported credential source, then rerun the live check.
```

## 🛠️ 命令

免费探测所有真实 adapter，不发起模型请求：

```bash
npm run doctor
```

端到端检查单个 runtime：

```bash
npm run doctor -- --runtime codex --live --timeout 120000
```

为 CI、Issue 报告或其他 UI 输出 JSON：

```bash
npm run doctor -- --runtime codex --live --json
```

在保留正常终端或 JSON 输出的同时，生成可分享的 Markdown 报告：

```bash
npm run doctor -- --runtime codex --live --report artifacts/codex-doctor.md
```

Doctor JSON 面向分享场景：包含版本、检查状态、确定性证据和建议，但不会包含
原始 runtime 输出或本机工作区路径。Markdown 报告遵循相同边界，可以直接附加
到 Issue 或作为 CI artifact。需要私有调试时，可以使用底层 `test --json` 查看
经过脱敏的 stdout 和 stderr。

直接调用底层 probe 和 test 契约：

```bash
npm run canary -- probe --runtime codex
npm run canary -- test --runtime fake
```

## 🔌 Adapter 覆盖

| Runtime | 可执行文件探测 | Live canary |
| --- | :---: | :---: |
| 确定性对照 runtime | 内置 | 内置 |
| Codex | 内置 | 内置 |
| Claude Code | 内置 | 仅 probe |

Adapter 只负责可执行文件发现和 runtime 特定的调用方式。超时、进程树终止、
输出捕获、脱敏、确定性证据、故障分类和清理全部由共享层处理。

添加新的 Coding Agent runtime 时，请参阅
[Adapter 编写指南](docs/adapter-authoring.md)。

## 🔐 Codex 认证隔离

Runtime Canary 默认使用空的 `CODEX_HOME`。如果 Codex 凭据存放在特定目录，
请显式指定：

```powershell
$env:RUNTIME_CANARY_CODEX_HOME = "$env:USERPROFILE\.codex"
$env:RUNTIME_CANARY_CODEX_COMMAND = "C:\path\to\codex.exe"
npm run doctor -- --runtime codex --live --timeout 120000
```

当 `codex` 已经能解析到可执行文件时，可以不设置 command override。Adapter
以 ephemeral session 运行 `codex exec`，忽略用户配置和规则，并请求
workspace-write sandbox。

## 🧰 确定性开发环境

开发测试框架不需要付费账号。内置对照 runtime 可以稳定复现成功、认证、网络、
权限、配置/MCP、启动失败、证据缺失、敏感信息输出和完整进程树超时：

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

运行完整本地验证：

```bash
npm test
npm run demo:check
npm run package:check
npm audit --omit=dev
```

`package:check` 会构建 npm tarball，将其安装到临时目录，通过 npm 生成的可执行
入口运行打包后的 CLI，验证全部五层检查，然后删除临时安装。它不会发布软件包。

## 🛡️ 安全模型

每次 live test 都会获得独立的 home、config、app-data、project 和临时目录。
Runtime 输出在进入终端或 JSON 结果之前会被脱敏。超时时会终止完整进程树，
包括 Windows 子进程；每个结果都会说明工作区是否清理成功。

这是可重复的进程隔离，不是安全沙箱。不要用它运行不受信任的代码。

## 🏗️ 架构

- `RuntimeAdapter` 将单个 Agent CLI 转换为共享契约。
- `runRuntimeTest` 管理确定性 Canary 的完整生命周期。
- `runDoctor` 负责编排多个 runtime 并生成可操作的分类结果。
- `CanaryVerifier` 独立于 runtime 输出验证文件证据。
- JSON 结果遵循 [Doctor 报告 Schema](schemas/doctor-result.schema.json)，
  使 CI 或未来界面不依赖终端格式。

## 📄 许可证

MIT
