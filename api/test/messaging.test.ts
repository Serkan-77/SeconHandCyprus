// Conversations, messages, two-sided meeting confirmation and ratings.
// Ports P0-03, P0-04, P0-05, P1-07 (message rate limit), P1-09 (deleted
// accounts) and P1-16 (blocks, privacy) of the old security scripts, through
// the API and — for the database guards — directly as the API's role.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { anon, asDbUser, newListing, newUser, resetDatabase, startApp, type Client, type TestApp } from "./helpers.ts";

let t: TestApp;
before(async () => {
  await resetDatabase();
  t = await startApp();
});
after(async () => t?.close());

async function setup() {
  const seller = await newUser(t, "Satıcı");
  const buyer = await newUser(t, "Alıcı");
  const outsider = await newUser(t, "Yabancı");
  const listing = await newListing(t, seller);
  const start = await buyer.post("/api/v1/conversations", { listingId: listing.id });
  assert.equal(start.statusCode, 200, start.body);
  return { seller, buyer, outsider, listing, conversationId: start.data.id as string };
}

async function send(c: Client, conversationId: string, body = "Merhaba, hâlâ satılık mı?") {
  return c.post(`/api/v1/conversations/${conversationId}/messages`, { body });
}

describe("starting conversations", () => {
  test("one conversation per buyer and listing; not with yourself; not on inactive listings", async () => {
    const { seller, buyer, listing, conversationId } = await setup();
    const again = await buyer.post("/api/v1/conversations", { listingId: listing.id });
    assert.equal(again.data.id, conversationId);
    assert.equal(again.data.created, false);
    assert.equal((await seller.post("/api/v1/conversations", { listingId: listing.id })).statusCode, 422);
    const pending = await newListing(t, seller, { title: "Bekleyen ilan" }, { approve: false });
    assert.equal((await buyer.post("/api/v1/conversations", { listingId: pending.id })).statusCode, 404);
  });

  test("client-sent timestamps and confirmations are ignored at the database (P0-04)", async () => {
    const seller = await newUser(t);
    const buyer = await newUser(t);
    const listing = await newListing(t, seller);
    const [row] = await asDbUser(buyer.id, "user", (sql) => sql`
      insert into conversations (listing_id, buyer_id, seller_id, buyer_confirmed_at, seller_confirmed_at, meeting_confirmed_at, created_at, last_message_at)
      values (${listing.id}, ${buyer.id}, ${seller.id}, '2000-01-01', '2000-01-01', '2000-01-01', '2000-01-01', '2099-01-01')
      returning buyer_confirmed_at, seller_confirmed_at, meeting_confirmed_at, created_at`);
    assert.equal(row.buyerConfirmedAt, null);
    assert.equal(row.sellerConfirmedAt, null);
    assert.equal(row.meetingConfirmedAt, null);
    assert.ok(Math.abs(new Date(row.createdAt).getTime() - Date.now()) < 60_000);
  });

  test("a conversation with a forged seller is refused (P0-04)", async () => {
    const seller = await newUser(t);
    const buyer = await newUser(t);
    const other = await newUser(t);
    const listing = await newListing(t, seller);
    await assert.rejects(
      asDbUser(buyer.id, "user", (sql) => sql`insert into conversations (listing_id, buyer_id, seller_id) values (${listing.id}, ${buyer.id}, ${other.id})`),
      /row-level security/,
    );
    await assert.rejects(
      asDbUser(buyer.id, "user", (sql) => sql`insert into conversations (listing_id, buyer_id, seller_id) values (${listing.id}, ${other.id}, ${seller.id})`),
      /row-level security/,
    );
  });
});

describe("privacy", () => {
  test("outsiders cannot read, list, write to or mark a conversation", async () => {
    const { buyer, outsider, conversationId } = await setup();
    await send(buyer, conversationId);
    assert.equal((await outsider.get(`/api/v1/conversations/${conversationId}`)).statusCode, 404);
    assert.equal((await outsider.get(`/api/v1/conversations/${conversationId}/messages`)).statusCode, 404);
    assert.equal((await send(outsider, conversationId)).statusCode, 404);
    assert.equal((await outsider.post(`/api/v1/conversations/${conversationId}/read`)).statusCode, 404);
    assert.equal((await outsider.post(`/api/v1/conversations/${conversationId}/meeting`)).statusCode, 404);
    assert.ok(!(await outsider.get("/api/v1/conversations")).data.conversations.some((c: { id: string }) => c.id === conversationId));
    assert.equal((await anon(t.app).get("/api/v1/conversations")).statusCode, 401);
    // Directly at the database, too.
    const rows = await asDbUser(outsider.id, "user", (sql) => sql`select id from messages where conversation_id = ${conversationId}`);
    assert.equal(rows.length, 0);
  });

  test("a message cannot be sent under someone else's name", async () => {
    const { buyer, seller, conversationId } = await setup();
    await assert.rejects(
      asDbUser(buyer.id, "user", (sql) => sql`insert into messages (conversation_id, sender_id, body) values (${conversationId}, ${seller.id}, 'Sahte')`),
      /row-level security/,
    );
  });
});

describe("messages", () => {
  test("messages are delivered, ordered and paged by keyset", async () => {
    const { buyer, seller, conversationId } = await setup();
    for (let i = 0; i < 7; i++) assert.equal((await send(i % 2 ? seller : buyer, conversationId, `Mesaj ${i}`)).statusCode, 200);
    const page1 = await buyer.get(`/api/v1/conversations/${conversationId}/messages?limit=3`);
    assert.deepEqual(page1.data.messages.map((m: { body: string }) => m.body), ["Mesaj 4", "Mesaj 5", "Mesaj 6"]);
    assert.equal(page1.data.hasMore, true);
    const oldest = page1.data.messages[0];
    const page2 = await buyer.get(`/api/v1/conversations/${conversationId}/messages?limit=3&before=${encodeURIComponent(oldest.createdAt)}&beforeId=${oldest.id}`);
    assert.deepEqual(page2.data.messages.map((m: { body: string }) => m.body), ["Mesaj 1", "Mesaj 2", "Mesaj 3"]);
  });

  test("client timestamps are ignored; sent messages are immutable; only read_at may change (P0-04, P0-05)", async () => {
    const { buyer, seller, conversationId } = await setup();
    const [m] = await asDbUser(buyer.id, "user", (sql) => sql`
      insert into messages (conversation_id, sender_id, body, created_at, read_at)
      values (${conversationId}, ${buyer.id}, 'Merhaba', '2000-01-01', '2000-01-01') returning id, created_at, read_at`);
    assert.equal(m.readAt, null);
    assert.ok(new Date(m.createdAt).getFullYear() > 2020);
    // The recipient cannot rewrite what they received.
    await assert.rejects(asDbUser(seller.id, "user", (sql) => sql`update messages set body = 'Değiştirildi' where id = ${m.id}`), /değiştirilemez/);
    // The sender cannot mark their own message read or edit it (no policy matches).
    const own = await asDbUser(buyer.id, "user", (sql) => sql`update messages set body = 'x' where id = ${m.id} returning id`);
    assert.equal(own.length, 0);
    // The recipient can mark it read; the time is the server's.
    const [r] = await asDbUser(seller.id, "user", (sql) => sql`update messages set read_at = '2000-01-01' where id = ${m.id} returning read_at`);
    assert.ok(new Date(r.readAt).getFullYear() > 2020);
  });

  test("participants cannot move a conversation's identity fields (P0-03)", async () => {
    const { buyer, seller, outsider, conversationId } = await setup();
    for (const [who, patch] of [
      [buyer, `seller_id = '${outsider.id}'`],
      [seller, `buyer_id = '${outsider.id}'`],
      [buyer, "listing_id = null"],
      [buyer, "last_message_at = '2099-01-01'"],
      [buyer, "meeting_confirmed_at = now()"],
    ] as const) {
      await assert.rejects(asDbUser(who.id, "user", (sql) => sql.unsafe(`update conversations set ${patch} where id = '${conversationId}'`)), /değiştirilemez/);
    }
  });

  test("reading clears the unread count and the message notification", async () => {
    const { buyer, seller, conversationId } = await setup();
    // The seller already has a "listing published" notification.
    const base = (await seller.get("/api/v1/me/counts")).data.notifications;
    await send(buyer, conversationId);
    await send(buyer, conversationId, "İkinci mesaj");
    let counts = await seller.get("/api/v1/me/counts");
    assert.equal(counts.data.messages, 2);
    assert.equal(counts.data.notifications, base + 1, "one notification per conversation");
    await seller.post(`/api/v1/conversations/${conversationId}/read`);
    counts = await seller.get("/api/v1/me/counts");
    assert.deepEqual(counts.data, { messages: 0, notifications: base });
  });

  test("blank, too long and HTML messages", async () => {
    const { buyer, conversationId } = await setup();
    assert.equal((await send(buyer, conversationId, "   ")).statusCode, 422);
    assert.equal((await send(buyer, conversationId, "x".repeat(2001))).statusCode, 422);
    const html = await send(buyer, conversationId, "<img src=x onerror=alert(1)>");
    assert.equal(html.statusCode, 200);
    assert.equal(html.data.message.body, "<img src=x onerror=alert(1)>", "stored as text; the client renders it as text");
  });

  test("21st message within a minute is refused with 429 (P1-07)", async () => {
    const { buyer, conversationId } = await setup();
    for (let i = 0; i < 20; i++) assert.equal((await send(buyer, conversationId, `m${i}`)).statusCode, 200);
    assert.equal((await send(buyer, conversationId, "fazla")).statusCode, 429);
  });
});

describe("blocks", () => {
  test("a block stops messages both ways, and can be lifted", async () => {
    const { buyer, seller, conversationId } = await setup();
    assert.equal((await seller.post(`/api/v1/users/${buyer.id}/block`)).statusCode, 200);
    assert.equal((await send(buyer, conversationId)).statusCode, 403);
    assert.equal((await send(seller, conversationId)).statusCode, 403);
    const view = await buyer.get(`/api/v1/conversations/${conversationId}`);
    assert.equal(view.data.conversation.canSend, false);
    assert.equal(view.data.conversation.blockedMe, true);
    // The database refuses it even if the API check were skipped.
    await assert.rejects(
      asDbUser(buyer.id, "user", (sql) => sql`insert into messages (conversation_id, sender_id, body) values (${conversationId}, ${buyer.id}, 'x')`),
      /row-level security/,
    );
    await seller.del(`/api/v1/users/${buyer.id}/block`);
    assert.equal((await send(buyer, conversationId)).statusCode, 200);
  });
});

describe("meeting confirmation and ratings (P0-04)", () => {
  test("the full two-sided flow", async () => {
    const { buyer, seller, outsider, conversationId } = await setup();
    const rate = (c: Client, score = 5) => c.post(`/api/v1/conversations/${conversationId}/rating`, { score, comment: "Sorunsuz" });

    assert.equal((await rate(buyer)).statusCode, 403, "no rating before any confirmation");
    // Neither side can confirm for the other.
    await assert.rejects(asDbUser(buyer.id, "user", (sql) => sql`update conversations set seller_confirmed_at = now() where id = ${conversationId}`), /onayını/);
    await assert.rejects(asDbUser(seller.id, "user", (sql) => sql`update conversations set buyer_confirmed_at = now() where id = ${conversationId}`), /onayını/);

    const first = await buyer.post(`/api/v1/conversations/${conversationId}/meeting`);
    assert.equal(first.data.bothConfirmed, false);
    let [c] = await t.owner`select * from conversations where id = ${conversationId}`;
    assert.ok(c.buyerConfirmedAt);
    assert.equal(c.meetingConfirmedAt, null);
    // A confirmation cannot be moved or withdrawn.
    const stamp = c.buyerConfirmedAt;
    await asDbUser(buyer.id, "user", (sql) => sql`update conversations set buyer_confirmed_at = null where id = ${conversationId}`);
    await asDbUser(buyer.id, "user", (sql) => sql`update conversations set buyer_confirmed_at = '2001-01-01' where id = ${conversationId}`);
    [c] = await t.owner`select * from conversations where id = ${conversationId}`;
    assert.equal(new Date(c.buyerConfirmedAt).getTime(), new Date(stamp).getTime());

    assert.equal((await rate(buyer)).statusCode, 403, "one side is not enough");
    assert.equal((await rate(seller)).statusCode, 403);

    const second = await seller.post(`/api/v1/conversations/${conversationId}/meeting`);
    assert.equal(second.data.bothConfirmed, true);

    assert.equal((await rate(outsider)).statusCode, 404, "outsiders cannot rate");
    assert.equal((await rate(buyer, 6)).statusCode, 422, "score 1–5");
    assert.equal((await rate(buyer)).statusCode, 200);
    assert.equal((await rate(buyer)).statusCode, 409, "once per conversation");
    const [r] = await t.owner`select * from ratings where conversation_id = ${conversationId} and rater_id = ${buyer.id}`;
    assert.equal(r.rateeId, seller.id, "the ratee is always the other participant");
    // Direct insert with a forged ratee or listing is refused / corrected.
    await assert.rejects(
      asDbUser(seller.id, "user", (sql) => sql`insert into ratings (rater_id, ratee_id, conversation_id, score) values (${seller.id}, ${outsider.id}, ${conversationId}, 1)`),
      /row-level security/,
    );
    await assert.rejects(
      asDbUser(seller.id, "user", (sql) => sql`insert into ratings (rater_id, ratee_id, conversation_id, score) values (${seller.id}, ${seller.id}, ${conversationId}, 5)`),
    );
    assert.equal((await rate(seller, 4)).statusCode, 200);
    const profile = await anon(t.app).get(`/api/v1/users/${seller.id}`);
    assert.equal(profile.data.profile.stats.ratingCount, 1);
  });
});

describe("deleted accounts (P1-09)", () => {
  test("the other side keeps the conversation; nobody can write into it", async () => {
    const { buyer, seller, conversationId } = await setup();
    await send(buyer, conversationId, "Görüşmek üzere");
    const del = await buyer.post("/api/v1/me/delete", { password: "Guclu-Sifre-2026" });
    assert.equal(del.statusCode, 200, del.body);
    const view = await seller.get(`/api/v1/conversations/${conversationId}`);
    assert.equal(view.statusCode, 200);
    assert.equal(view.data.conversation.other, null);
    assert.equal(view.data.conversation.canSend, false);
    const history = await seller.get(`/api/v1/conversations/${conversationId}/messages`);
    assert.equal(history.data.messages[0].body, "Görüşmek üzere");
    assert.equal(history.data.messages[0].senderId, null);
    assert.equal((await send(seller, conversationId)).statusCode, 403);
    const [{ n }] = await t.owner`select count(*)::int as n from auth.users where id = ${buyer.id}`;
    assert.equal(n, 0);
  });

  test("a restricted account cannot delete itself; deletion needs the password", async () => {
    const u = await newUser(t);
    assert.equal((await u.post("/api/v1/me/delete", { password: "yanlış" })).statusCode, 403);
    await t.owner`insert into sanctions (user_id, kind, reason) values (${u.id}, 'suspend', 'Test askıya alma')`;
    const res = await u.post("/api/v1/me/delete", { password: "Guclu-Sifre-2026" });
    assert.equal(res.statusCode, 403);
    assert.match(res.data.error.message, /kısıtlıyken/);
  });
});
