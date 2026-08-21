# Runtime Canary

[![CI](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml/badge.svg)](https://github.com/2810029110/runtime-canary/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2f855a.svg)](LICENSE)

**Returning `--version` is not enough: deterministic canaries for coding-agent runtimes.**

A CLI can pass `--version` and still fail while loading a skill, reading
configuration, starting an MCP server, or invoking a tool. Runtime Canary runs
a known-good, deterministic canary in an isolated workspace and reports exactly
which layer failed.

> **Early vertical slice:** full test execution currently works only with the
> bundled fake runtime. Claude Code and Codex are probe-only adapters. Runtime
> Canary does not yet claim end-to-end support for either real runtime.

```text
[+] fake: PASS
  duration: <measured>
  isolated workspace cleaned: yes
  canary: matched
```

## Five-minute quickstart

```bash
git clone https://github.com/2810029110/runtime-canary.git
cd runtime-canary
npm install
npm test
npm run demo
```

The demo invokes the real CLI process for an available probe, a passing canary,
and a forced timeout. Its checked-in output is regenerated and verified in CI:
[`docs/demo-output.txt`](docs/demo-output.txt).

## What works today

| Command | fake | Claude Code | Codex |
| --- | --- | --- | --- |
| `probe` | Available | CLI discovery and version probe | CLI discovery and version probe |
| `test` | Deterministic canary | Not implemented | Not implemented |

Probe results use explicit states: `AVAILABLE`, `NOT_INSTALLED`,
`UNEXECUTABLE`, and `UNSUPPORTED_VERSION`. The last state is part of the result
contract for adapters that enforce a version range; the current adapters do not
yet apply a version policy.

Test results are `PASS`, `ASSERTION_FAILED`, `TIMEOUT`, `RUNTIME_DEGRADED`, or
`HARNESS_ERROR`. JSON results follow
[`schemas/test-result.schema.json`](schemas/test-result.schema.json).

## Run individual checks

Runtime Canary requires Node.js 22.18 or newer. Its only runtime dependency is
`cross-spawn`, used so npm-installed `.cmd` shims execute correctly on Windows
without enabling a command shell for runtime arguments.

```bash
npm run canary -- probe --runtime fake
npm run canary -- test --runtime fake
```

A successful run looks like this:

```text
[+] fake: PASS
  duration: 164ms
  isolated workspace cleaned: yes
  canary: matched
```

Use `--json` for machine-readable output:

```bash
npm run canary -- test --runtime fake --json
```

Exercise deterministic failure paths without a real agent account:

```bash
npm run canary -- test --runtime fake --simulate timeout --timeout 350
npm run canary -- test --runtime fake --simulate startup-failure
npm run canary -- test --runtime fake --simulate secret --json
```

Probe locally installed CLIs:

```bash
npm run canary -- probe --runtime claude
npm run canary -- probe --runtime codex
```

These commands only discover and run the local executable's version command.
They do not install a CLI, authenticate an account, or run a real canary.

## Execution model

Each test creates a temporary project, home, config, and temp directory. The
child process receives overrides for `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`,
`APPDATA`, `LOCALAPPDATA`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `TMPDIR`, `TMP`,
and `TEMP`. Runtime output, exit code, duration, and deterministic file evidence
are collected. Secrets are redacted before output is returned. Timeouts
terminate the full child process tree, including on Windows, and the temporary
workspace is removed.

This is process isolation for repeatable tests, not a security sandbox. The
runtime still executes with the current user's credentials and operating-system
permissions. Do not use Runtime Canary to run untrusted code.

## Architecture

- `RuntimeAdapter` owns runtime-specific discovery and invocation construction.
- The shared runner owns timeouts, process-tree termination, output capture, and
  redaction.
- `CanaryVerifier` is separate from the runtime adapter so evidence mechanisms
  can evolve without changing process execution.
- A checked-in JSON schema keeps automation consumers independent of terminal
  formatting.

## Next milestone

The next milestone is one real runtime adapter that executes the same canary
contract as the fake runtime. It will be gated by integration tests on a machine
with that CLI already installed and authenticated. Broader runtime coverage,
baseline comparison, semantic assertions, and model-based judging remain out of
scope until that path is reliable.

See [the adapter authoring guide](docs/adapter-authoring.md) for the runtime
contract and [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## What success means

Stars are useful distribution signals, but they do not prove that the runtime
diagnostic works. Runtime Canary uses three gates:

1. **Engineering ready:** warning-free CI on three operating systems and a
   clean runner that installs, runs the demo, and passes tests within five
   minutes.
2. **Product proven:** one real coding-agent CLI passes a verified canary and
   the tool catches a failure that `--version` misses.
3. **Externally useful:** five people reproduce the workflow without maintainer
   help, and at least two keep using it after two weeks.

The complete measurements and 30-day signals are in
[`docs/success-criteria.md`](docs/success-criteria.md).

## License

[MIT](LICENSE)
