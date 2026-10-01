// P1-10: a listing submission is identified by its key until the draft changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDraftPatch, emptyDraft, hasContent, parseDraft } from "../src/lib/listingDraft.ts";

const KEY = "0b0e4a8e-7c1d-4f5e-9a3b-2c6d8e1f0a4b";

test("a retry keeps the submission key", () => {
  const draft = applyDraftPatch({ ...emptyDraft, title: "Berjer" }, { submissionKey: KEY });
  assert.equal(draft.submissionKey, KEY);
  assert.equal(draft.title, "Berjer");
});

test("editing the draft makes it a new submission", () => {
  const sent = applyDraftPatch(emptyDraft, { submissionKey: KEY });
  for (const patch of [{ title: "Yeni başlık" }, { price: "10" }, { photos: [{ key: "l/2026/10/x", urls: { sm: "", md: "", lg: "" } }] }, { attributes: { brand: "apple" } }]) {
    assert.equal(applyDraftPatch(sent, patch).submissionKey, "");
  }
});

test("stored drafts are parsed defensively", () => {
  assert.deepEqual(parseDraft(null), emptyDraft);
  assert.deepEqual(parseDraft("{not json"), emptyDraft);
  const d = parseDraft(JSON.stringify({ title: "Bisiklet", photos: [{ key: "k", urls: { sm: "a", md: "b", lg: "c" } }, null, { nope: 1 }], attributes: [1], currency: "$" }));
  assert.equal(d.title, "Bisiklet");
  assert.equal(d.photos.length, 1);
  assert.deepEqual(d.attributes, {});
  assert.equal(d.currency, "TL");
});

test("only real work is offered for resuming", () => {
  assert.equal(hasContent({ ...emptyDraft, categoryId: 3 }), false);
  assert.equal(hasContent({ ...emptyDraft, title: "x" }), true);
});
