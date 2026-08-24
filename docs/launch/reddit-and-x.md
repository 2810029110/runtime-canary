# Reddit and X

## Reddit title

```text
A CLI passing --version can still be functionally dead, so I built a five-layer canary for coding agents
```

## Reddit post

Most runtime checks stop after finding the executable and running `--version`.
That misses the failures that actually waste time: expired authentication,
blocked connections, read-only sandboxes, stuck child processes, and agents
that exit successfully without using their tools.

I built Runtime Canary to test the full path:

```text
discovery -> launch -> task -> deterministic evidence -> cleanup
```

The live Doctor creates an isolated workspace, requests a tiny file-writing
task with a random token, verifies the file independently, and reports a stable
finding code with the next action. It also kills the full process tree on
timeout and reports whether cleanup succeeded.

There is a deterministic fixture for reproducing authentication, network,
permission, configuration, missing-evidence, timeout, and redaction paths
without paying for a model request. Codex has a live adapter today; Claude Code
is probe-only. It uses existing installations and authentication, and does not
perform login or credential management.

I am looking for feedback on the isolation contract and useful failure fixtures,
not just stars:

https://github.com/2810029110/runtime-canary

Suggested communities: `r/programming`, `r/node`, and agent-specific communities
where self-promotion is permitted. Read each community's current rules before
posting; do not submit the same copy everywhere at once.

## X single post

```text
Your coding-agent CLI passes --version. Is it actually able to authenticate, use tools, write evidence, and clean up?

Runtime Canary checks all five layers and attributes the failure instead of returning a generic process error.

Codex live canary; Claude Code probe-only. No login or credential management.

https://github.com/2810029110/runtime-canary
```

Suggested tags: `#CodingAgents #MCP #TypeScript #DevTools`

## X thread

```text
1/ `--version` proves two things: the CLI was found and the process launched. It does not prove the agent can work.

2/ Runtime Canary adds three missing checkpoints: complete a task, produce deterministic file evidence, and clean the isolated workspace.

3/ A successful exit without the requested artifact is still a failure. Timeouts terminate the complete process tree, including descendants on Windows.

4/ Findings distinguish authentication, network, permissions, configuration, timeout, missing evidence, and cleanup failures.

5/ The demo uses a labeled deterministic fixture. Current adapter coverage is Codex live canary and Claude Code probe-only.

https://github.com/2810029110/runtime-canary
```
