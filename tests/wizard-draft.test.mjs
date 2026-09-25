import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDraftPatch, emptyDraft } from "../src/lib/wizardStore.ts";

const KEY = "0b0e4a8e-7c1d-4f5e-9a3b-2c6d8e1f0a4b";

test("a retry keeps the submission key", () => {
  const draft = applyDraftPatch({ ...emptyDraft, title: "Berjer" }, { submissionKey: KEY });
  assert.equal(draft.submissionKey, KEY);
  assert.equal(draft.title, "Berjer");
});

test("editing the draft makes it a new submission", () => {
  const sent = applyDraftPatch(emptyDraft, { submissionKey: KEY });
  for (const patch of [{ title: "Yeni başlık" }, { price: "10" }, { photos: ["u/2.jpg"] }]) {
    assert.equal(applyDraftPatch(sent, patch).submissionKey, "");
  }
});
