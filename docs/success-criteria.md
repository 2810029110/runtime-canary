# Product scorecard

Runtime Canary measures what an agent runtime can actually complete, not only
whether its executable responds. The public scorecard is based on reproducible
capabilities that can be demonstrated from a clean checkout.

## Observable coverage

| Check | `--version` | Doctor probe | Doctor live |
| --- | :---: | :---: | :---: |
| Executable discovered | Yes | Yes | Yes |
| Process launches | Yes | Yes | Yes |
| Agent task completes | No | No | Yes |
| Deterministic file evidence matches | No | No | Yes |
| Isolated workspace is cleaned | No | No | Yes |

The live Doctor exposes five checkpoints instead of two, a 2.5x increase over
a version check. A successful process exit without matching evidence does not
count as a pass.

## Reproducible failure coverage

The deterministic control runtime exercises authentication, network, sandbox
permission, configuration/MCP, startup, evidence, timeout, secret-redaction,
and cleanup behavior without a paid model account. Each scenario has an
expected status, finding code, and cleanup result in the automated test suite.

## Release checks

- Tests pass on Ubuntu, Windows, and macOS.
- The deterministic demo matches its checked-in output.
- The npm tarball installs in a temporary directory and its packaged executable
  completes a five-layer live canary.
- Timeout coverage proves the descendant process is terminated.
- Shareable JSON and Markdown omit raw output and local temporary paths.
- The production dependency audit reports no known vulnerabilities.

Run the same checks locally:

```bash
npm test
npm run demo:check
npm run package:check
npm audit --omit=dev
```

## Adoption metrics

After release, track the funnel that shows whether the product story converts:

```text
repository visit -> packaged CLI run -> live runtime attempt -> shared report
```

Useful measurements are successful packaged runs, live attempts by runtime,
finding-code distribution from user-submitted reports, time to identify the
failing layer, repeat CI usage, and external adapter contributions. Runtime
Canary does not add telemetry; published numbers should come from GitHub traffic,
issues, pull requests, and voluntarily shared reports.
