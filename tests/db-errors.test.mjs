import { test } from "node:test";
import assert from "node:assert/strict";
import { accountDeletionMessage, rateLimitMessage, reportErrorMessage } from "../src/lib/dbErrors.ts";

test("PT429 errors pass their message through", () => {
  assert.equal(rateLimitMessage({ code: "PT429", message: "Çok hızlı mesaj gönderiyorsun." }), "Çok hızlı mesaj gönderiyorsun.");
});

test("other errors are not shown to the user", () => {
  assert.equal(rateLimitMessage({ code: "42501", message: "new row violates row-level security policy" }), null);
  assert.equal(rateLimitMessage({ message: "fetch failed" }), null);
  assert.equal(rateLimitMessage(null), null);
  assert.equal(rateLimitMessage(undefined), null);
});

test("report errors: duplicate, own target, rate limit", () => {
  assert.match(reportErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" }), /zaten şikayet ettin/);
  assert.equal(reportErrorMessage({ code: "23514", message: "Kendini ya da kendi ilanını şikayet edemezsin." }), "Kendini ya da kendi ilanını şikayet edemezsin.");
  assert.equal(reportErrorMessage({ code: "PT429", message: "Bir saatte en fazla 10 şikayet gönderebilirsin." }), "Bir saatte en fazla 10 şikayet gönderebilirsin.");
  assert.equal(reportErrorMessage({ code: "42501", message: "row-level security" }), null);
  assert.equal(reportErrorMessage({ code: "23514", message: 'new row for relation "reports" violates check constraint "reports_reason_length"' }), null);
});

test("account deletion refused while restricted", () => {
  assert.match(accountDeletionMessage({ code: "PT403", message: "Hesabın kısıtlıyken silinemez." }), /kısıtlıyken/);
  assert.equal(accountDeletionMessage({ code: "XX000", message: "boom" }), null);
});
