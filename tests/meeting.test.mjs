// Chat-side rules of the two-sided meeting confirmation (P0-04).
// The database enforces them; these tests pin what the chat renders.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { MEETING_TEXT, meetingActions, meetingFor, meetingStage } from "../src/lib/meeting.ts";

const BUYER = "buyer-id";
const SELLER = "seller-id";
const row = (buyer, seller) => ({ buyer_id: BUYER, buyer_confirmed_at: buyer, seller_confirmed_at: seller });
const T = "2026-09-25T20:00:00Z";

test("each participant sees their own confirmation as 'mine'", () => {
  assert.deepEqual(meetingFor(row(T, null), BUYER), { mine: true, theirs: false });
  assert.deepEqual(meetingFor(row(T, null), SELLER), { mine: false, theirs: true });
  assert.deepEqual(meetingFor(row(null, T), BUYER), { mine: false, theirs: true });
  assert.deepEqual(meetingFor(row(null, T), SELLER), { mine: true, theirs: false });
});

test("nobody confirmed: confirm button, no rating, no status text", () => {
  const state = meetingFor(row(null, null), BUYER);
  assert.equal(meetingStage(state), "none");
  assert.deepEqual(meetingActions(state), { canConfirm: true, canRate: false });
});

test("I confirmed: waiting text, no confirm button, no rating", () => {
  const state = meetingFor(row(T, null), BUYER);
  assert.equal(meetingStage(state), "waiting");
  assert.equal(MEETING_TEXT.waiting, "Sen buluşmayı onayladın. Karşı tarafın onayı bekleniyor.");
  assert.deepEqual(meetingActions(state), { canConfirm: false, canRate: false });
});

test("only the other side confirmed: their text plus my confirm button, no rating", () => {
  const state = meetingFor(row(T, null), SELLER);
  assert.equal(meetingStage(state), "theirs");
  assert.equal(MEETING_TEXT.theirs, "Karşı taraf buluşmayı onayladı.");
  assert.deepEqual(meetingActions(state), { canConfirm: true, canRate: false });
});

test("both confirmed: rating opens for both sides", () => {
  for (const me of [BUYER, SELLER]) {
    const state = meetingFor(row(T, T), me);
    assert.equal(meetingStage(state), "confirmed");
    assert.equal(MEETING_TEXT.confirmed, "Buluşma iki taraf tarafından onaylandı.");
    assert.deepEqual(meetingActions(state), { canConfirm: false, canRate: true });
  }
});
