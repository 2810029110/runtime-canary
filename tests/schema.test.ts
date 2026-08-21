import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DOCTOR_STATUSES, TEST_STATUSES } from "../src/domain/types.ts";
import { FakeRuntimeAdapter } from "../src/adapters/fake.ts";
import { runDoctor } from "../src/doctor.ts";
import { runRuntimeTest } from "../src/run-test.ts";

test("test result conforms to the checked-in structural contract", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schemas/test-result.schema.json", import.meta.url), "utf8"),
  ) as {
    required: string[];
    properties: { status: { enum: string[] } };
  };
  const result = await runRuntimeTest(new FakeRuntimeAdapter());

  for (const key of schema.required) {
    assert.ok(key in result, `missing required key: ${key}`);
  }
  assert.deepEqual(schema.properties.status.enum, [...TEST_STATUSES]);
  assert.ok(schema.properties.status.enum.includes(result.status));
  assert.equal(result.schemaVersion, 1);
  assert.equal(typeof result.runtime, "string");
  assert.equal(typeof result.startedAt, "string");
  assert.equal(typeof result.durationMs, "number");
  assert.ok(result.exitCode === null || Number.isInteger(result.exitCode));
  assert.equal(typeof result.timedOut, "boolean");
  assert.equal(typeof result.stdout, "string");
  assert.equal(typeof result.stderr, "string");
  assert.ok(result.diagnostic === null || typeof result.diagnostic === "string");
  assert.equal(typeof result.evidence?.path, "string");
  assert.equal(typeof result.evidence?.observed, "boolean");
  assert.equal(typeof result.evidence?.tokenMatched, "boolean");
  assert.equal(typeof result.isolation.workspaceRoot, "string");
  assert.equal(typeof result.isolation.cleaned, "boolean");
});

test("doctor result conforms to the checked-in structural contract", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schemas/doctor-result.schema.json", import.meta.url), "utf8"),
  ) as {
    required: string[];
    properties: {
      runtimes: { items: { required: string[]; properties: { status: { enum: string[] } } } };
    };
  };
  const report = await runDoctor({ adapters: [new FakeRuntimeAdapter()], live: true });

  for (const key of schema.required) {
    assert.ok(key in report, `missing required key: ${key}`);
  }
  const runtimeSchema = schema.properties.runtimes.items;
  for (const key of runtimeSchema.required) {
    assert.ok(key in report.runtimes[0], `missing runtime key: ${key}`);
  }
  assert.deepEqual(runtimeSchema.properties.status.enum, [...DOCTOR_STATUSES]);
  assert.ok(runtimeSchema.properties.status.enum.includes(report.runtimes[0].status));
});
