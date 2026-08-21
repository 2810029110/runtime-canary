# Success criteria

Runtime Canary is successful only when it is reliable, proves value against a
real coding-agent runtime, and is useful to people outside the project. GitHub
stars alone do not meet that standard.

## 1. Engineering readiness

These are commit and release gates:

- GitHub Actions completes on Ubuntu, macOS, and Windows with no warnings.
- A fresh, uncached runner installs dependencies, runs the demo, and passes the
  test suite in less than five minutes.
- `PASS`, `ASSERTION_FAILED`, `TIMEOUT`, `RUNTIME_DEGRADED`, and
  `HARNESS_ERROR` have deterministic tests.
- Every test status reports whether its workspace was cleaned; timeout coverage
  also proves the grandchild process is no longer alive.
- The fake control canary has zero false failures in the normal CI suite.
- npm audit reports no known production dependency vulnerabilities.

Engineering readiness means the harness is trustworthy. It does not prove the
product solves a real coding-agent problem.

## 2. Product proof

Target for the first real-adapter milestone:

- One real, already installed and authenticated coding-agent CLI executes the
  canary through the shared runner.
- A documented failure fixture passes the CLI version probe but fails the
  canary with the correct Runtime Canary status.
- Five external users obtain their first canary result within five minutes and
  without maintainer intervention during a 30-day validation period.
- At least four of those five users can identify the failing layer from the
  result without reading Runtime Canary source code.
- At least two users keep the check in a repeated workflow or CI job after 14
  days.

Track false positives and time-to-diagnosis for every real adapter. A canary
that frequently blames a healthy runtime is not production-ready.

## 3. Open-source signals

Review these after 30 days:

- Three substantive issues, discussions, or adapter proposals from people who
  ran the tool.
- One external contribution or independently verified adapter result.
- Stars and unique clones are recorded as reach indicators only. Initial
  directional targets are 10 stars and 25 unique clones, but neither overrides
  failed product-proof gates.

The useful conversion is:

```text
repository visit -> successful demo -> real runtime attempt -> feedback or contribution
```

GitHub traffic cannot prove each step automatically. Record anonymized counts
from GitHub traffic and issue/PR activity; do not add product telemetry merely
to inflate the metric.

## Decision rule

- **Continue investment:** engineering gates pass and real-adapter validation
  shows users diagnose a failure faster than with version checks alone.
- **Revise positioning:** engineering gates pass but users treat it as a generic
  process runner or cannot understand the status output.
- **Stop or redesign:** a real adapter cannot produce stable deterministic
  evidence, or false positives remain common after two focused iterations.
