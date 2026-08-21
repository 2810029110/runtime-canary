# Adapter authoring guide

An adapter translates Runtime Canary's deterministic contract into one coding
agent CLI. It does not own process safety or result formatting.

## Contract

Every adapter implements:

```ts
interface RuntimeAdapter {
  id: string;
  displayName: string;
  probe(): Promise<ProbeResult>;
  createInvocation?(context: RuntimeContext):
    RuntimeInvocation | Promise<RuntimeInvocation>;
}
```

`probe()` must classify discovery without installing or authenticating a CLI.
Use `NOT_INSTALLED` for a missing command and `UNEXECUTABLE` when the command is
present but cannot run. Only return `UNSUPPORTED_VERSION` when the adapter has
an explicit, tested version policy.

`createInvocation()` is optional. Omit it for a probe-only adapter. When
implemented, it receives an isolated project directory and a one-time canary
token. The invocation must cause deterministic evidence to appear at the path
expected by its verifier.

## Ownership boundaries

The adapter owns:

- executable and arguments;
- runtime-specific environment additions;
- prompt or fixture construction required by that runtime.

The shared runner owns:

- temporary home, config, app-data, and project directories;
- timeout and process-tree termination;
- stdout/stderr capture and secret redaction;
- cleanup and structured result status.

Do not mutate `process.env`, user configuration, or the source checkout.

## Acceptance checklist

- Probe tests cover missing, executable, and relevant version cases.
- The adapter invokes the real CLI through the shared spawn path.
- A known-good canary passes on a documented CLI version and operating system.
- Startup failure is distinct from missing canary evidence.
- Timeout leaves no child or grandchild process alive.
- No raw secret appears in serialized results.
- README capability tables are updated without overstating coverage.

Use [`src/adapters/fake.ts`](../src/adapters/fake.ts) as the contract reference,
not as evidence that a real runtime works.
