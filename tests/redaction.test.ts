import test from "node:test";
import assert from "node:assert/strict";
import { redactText } from "../src/redaction.ts";

test("redacts complete and provider-masked OpenAI API keys", () => {
  const complete = "sk-example1234567890";
  const masked = "sk-examp********************************7890";
  const result = redactText(`complete=${complete} masked=${masked}`);

  assert.equal(result, "complete=[REDACTED] masked=[REDACTED]");
});
