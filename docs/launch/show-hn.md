# Show HN

## Title

```text
Show HN: Runtime Canary – Passing --version doesn't mean your coding agent works
```

## Post

I built Runtime Canary around a small but expensive failure mode: a coding-agent
CLI can return a healthy version string while authentication is expired, a
proxy blocks the request, the sandbox is read-only, a child process hangs, or
the requested tool never produces an artifact.

Runtime Canary treats that as a pre-flight problem. Its live Doctor creates an
isolated workspace, gives the runtime a random token, asks it to complete a
small tool-use task, verifies the exact JSON file independently, and then proves
the workspace and timed-out process tree were cleaned up.

The result is five observable checkpoints instead of the two exposed by a
version command: discovery, launch, task, evidence, and cleanup. Failures are
classified into stable categories such as authentication, network, permission,
configuration, timeout, and missing evidence, with a concrete next action.

The repository includes a deterministic fixture for developing and reproducing
failure paths without a paid model request. Codex has a live adapter; Claude
Code is currently probe-only. The tool does not install CLIs, perform logins,
or manage credentials.

I would especially value feedback on the canary contract, isolation model, and
which runtime adapter should be verified next:

https://github.com/2810029110/runtime-canary

## First comment

The demo GIF uses the deterministic configuration-failure fixture. It is labeled
as a controlled fixture so it is easy to reproduce without presenting it as a
real Codex or MCP result. The complete packaged-CLI check is available as
`npm run package:check`.
