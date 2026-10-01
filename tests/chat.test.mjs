// P1-11: the chat list stays ordered and duplicate-free while older pages,
// live events and optimistic sends arrive in any order.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReadReceipt, compareMessages, dayKey, mergeMessages } from "../src/lib/chat.ts";

const msg = (n, at = `2026-09-25T10:${String(n).padStart(2, "0")}:00+00:00`) => ({
  id: `m${String(n).padStart(3, "0")}`,
  body: `b${n}`,
  senderId: "u",
  createdAt: at,
  readAt: null,
});

test("messages sort chronologically, ties broken by id", () => {
  const same = "2026-09-25T10:00:00+00:00";
  const list = [msg(3), msg(1), { ...msg(2), createdAt: same, id: "b" }, { ...msg(2), createdAt: same, id: "a" }];
  assert.deepEqual(list.sort(compareMessages).map((m) => m.id), ["a", "b", "m001", "m003"]);
});

test("merging older pages and live inserts keeps order and drops duplicates", () => {
  const current = [msg(5), msg(6)];
  const merged = mergeMessages(current, [msg(3), msg(4), msg(5), msg(7)]);
  assert.deepEqual(merged.map((m) => m.id), ["m003", "m004", "m005", "m006", "m007"]);
  const read = mergeMessages(merged, [{ ...msg(6), readAt: "2026-09-25T11:00:00+00:00" }]);
  assert.equal(read.find((m) => m.id === "m006").readAt, "2026-09-25T11:00:00+00:00");
  assert.equal(read.length, 5);
});

test("an optimistic message is replaced by the server copy, whichever arrives first", () => {
  const temp = { ...msg(8), id: "tmp-1", pending: "sending" };
  const real = { ...msg(8), id: "m008" };
  // Send result first.
  let list = mergeMessages([msg(7), temp], [{ ...real, tempId: "tmp-1" }]);
  assert.deepEqual(list.map((m) => m.id), ["m007", "m008"]);
  assert.equal(list[1].pending, undefined);
  // Live event first, then the send result.
  list = mergeMessages([msg(7), temp], [real]);
  list = mergeMessages(list, [{ ...real, tempId: "tmp-1" }]);
  assert.deepEqual(list.map((m) => m.id), ["m007", "m008"]);
});

test("failed sends stay at the end for retrying", () => {
  const failed = { ...msg(1), id: "tmp-x", pending: "failed" };
  const list = mergeMessages([failed], [msg(5), msg(6)]);
  assert.deepEqual(list.map((m) => m.id), ["m005", "m006", "tmp-x"]);
});

test("read receipts mark only my delivered messages up to the time", () => {
  const mine = [{ ...msg(1) }, { ...msg(2) }, { ...msg(3), senderId: "other" }, { ...msg(4), pending: "sending" }, { ...msg(9) }];
  const out = applyReadReceipt(mine, "u", "2026-09-25T10:05:00+00:00");
  assert.deepEqual(out.map((m) => Boolean(m.readAt)), [true, true, false, false, false]);
});

test("day keys group by local calendar day", () => {
  assert.equal(dayKey("2026-09-25T10:00:00"), dayKey("2026-09-25T23:59:00"));
  assert.notEqual(dayKey("2026-09-25T10:00:00"), dayKey("2026-09-26T00:01:00"));
});
