import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimitMessage } from "../src/lib/dbErrors.ts";

test("PT429 errors pass their message through", () => {
  assert.equal(rateLimitMessage({ code: "PT429", message: "Çok hızlı mesaj gönderiyorsun." }), "Çok hızlı mesaj gönderiyorsun.");
});

test("other errors are not shown to the user", () => {
  assert.equal(rateLimitMessage({ code: "42501", message: "new row violates row-level security policy" }), null);
  assert.equal(rateLimitMessage({ message: "fetch failed" }), null);
  assert.equal(rateLimitMessage(null), null);
  assert.equal(rateLimitMessage(undefined), null);
});
