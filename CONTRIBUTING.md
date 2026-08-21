# Contributing to Runtime Canary

Runtime Canary is intentionally small. Contributions should improve the
deterministic runtime contract or add a runtime that can be tested honestly.

## Development setup

Requirements: Node.js 22.18 or newer and Git.

```bash
npm install
npm test
npm run demo:check
npm pack --dry-run
```

Tests must not require a paid model account, modify global CLI configuration,
or write outside their isolated temporary workspace.

## Workflow

1. Create a focused branch from `main`.
2. Add or update tests with the behavior change.
3. Run the four validation commands above.
4. Open a pull request that states the runtime, operating systems, CLI version,
   authentication assumptions, and observed evidence.

Do not claim a real adapter works based only on mocked execution. A real adapter
needs an integration result from an already installed and authenticated CLI.

## Adding an adapter

Read [the adapter authoring guide](docs/adapter-authoring.md). Start with probe
support, then add test execution only after the canary passes against the real
runtime. Keep runtime-specific command construction in the adapter; timeout,
redaction, isolation, and cleanup belong in the shared runner.
