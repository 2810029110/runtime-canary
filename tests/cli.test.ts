import test from "node:test";
import assert from "node:assert/strict";
import { main } from "../src/cli.ts";

test("unknown runtime returns a usage error", async () => {
  const originalError = console.error;
  const messages: string[] = [];
  console.error = (...values) => { messages.push(values.join(" ")); };
  try {
    const code = await main(["probe", "--runtime", "unknown"]);
    assert.equal(code, 2);
    assert.match(messages.join("\n"), /Unknown runtime/);
  } finally {
    console.error = originalError;
  }
});

test("test --json emits a complete machine-readable result", async () => {
  const originalLog = console.log;
  const messages: string[] = [];
  console.log = (...values) => { messages.push(values.join(" ")); };
  try {
    const code = await main(["test", "--runtime", "fake", "--json"]);
    assert.equal(code, 0);
    const result = JSON.parse(messages.join("\n")) as {
      status: string;
      evidence: { tokenMatched: boolean };
      isolation: { cleaned: boolean };
    };
    assert.equal(result.status, "PASS");
    assert.equal(result.evidence.tokenMatched, true);
    assert.equal(result.isolation.cleaned, true);
  } finally {
    console.log = originalLog;
  }
});
