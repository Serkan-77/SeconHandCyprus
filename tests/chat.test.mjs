// P1-11: chat opens on the newest messages; older pages load on demand.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { compareMessages, fetchLatestMessages, fetchOlderMessages, mergeMessages } from "../src/lib/chat.ts";

const msg = (n, at = `2026-09-25T10:${String(n).padStart(2, "0")}:00+00:00`) => ({
  id: `m${String(n).padStart(3, "0")}`,
  body: `b${n}`,
  sender_id: "u",
  created_at: at,
  read_at: null,
});

/** A stand-in for the Supabase query builder: records calls, returns rows newest first. */
function fakeClient(rows) {
  const calls = [];
  const builder = {
    select: (...a) => (calls.push(["select", ...a]), builder),
    eq: (...a) => (calls.push(["eq", ...a]), builder),
    or: (...a) => (calls.push(["or", ...a]), builder),
    order: (...a) => (calls.push(["order", ...a]), builder),
    limit: (n) => (calls.push(["limit", n]), Promise.resolve({ data: rows.slice(0, n), error: null })),
  };
  return { client: { from: (t) => (calls.push(["from", t]), builder) }, calls };
}

test("messages sort chronologically, ties broken by id", () => {
  const same = "2026-09-25T10:00:00+00:00";
  const list = [msg(3), msg(1), { ...msg(2), created_at: same, id: "b" }, { ...msg(2), created_at: same, id: "a" }];
  assert.deepEqual(list.sort(compareMessages).map((m) => m.id), ["a", "b", "m001", "m003"]);
});

test("merging older pages and live inserts keeps order and drops duplicates", () => {
  const current = [msg(5), msg(6)];
  const merged = mergeMessages(current, [msg(3), msg(4), msg(5), msg(7)]);
  assert.deepEqual(merged.map((m) => m.id), ["m003", "m004", "m005", "m006", "m007"]);
  const read = mergeMessages(merged, [{ ...msg(6), read_at: "2026-09-25T11:00:00+00:00" }]);
  assert.equal(read.find((m) => m.id === "m006").read_at, "2026-09-25T11:00:00+00:00");
  assert.equal(read.length, 5);
});

test("latest page: newest N, returned oldest first, hasMore from the extra row", async () => {
  const rows = Array.from({ length: 8 }, (_, i) => msg(8 - i)); // newest first, as the DB returns
  const { client, calls } = fakeClient(rows);
  const page = await fetchLatestMessages(client, "c1", 3);
  assert.deepEqual(page.messages.map((m) => m.id), ["m006", "m007", "m008"]);
  assert.equal(page.hasMore, true);
  assert.deepEqual(calls.find((c) => c[0] === "limit"), ["limit", 4]);
  assert.deepEqual(calls.filter((c) => c[0] === "order").map((c) => [c[1], c[2].ascending]), [["created_at", false], ["id", false]]);
  const last = await fetchLatestMessages(fakeClient(rows.slice(0, 2)).client, "c1", 3);
  assert.equal(last.hasMore, false);
  assert.equal(last.messages.length, 2);
});

test("older page uses a (created_at, id) keyset before the first loaded message", async () => {
  const { client, calls } = fakeClient([msg(4), msg(3)]);
  const page = await fetchOlderMessages(client, "c1", { created_at: "2026-09-25T10:05:00+00:00", id: "m005" }, 3);
  assert.deepEqual(page.messages.map((m) => m.id), ["m003", "m004"]);
  assert.equal(page.hasMore, false);
  assert.deepEqual(calls.find((c) => c[0] === "or"), [
    "or",
    "created_at.lt.2026-09-25T10:05:00+00:00,and(created_at.eq.2026-09-25T10:05:00+00:00,id.lt.m005)",
  ]);
});
