// Realtime: sockets must authenticate, receive only their own events, and
// refuse cookie authentication from foreign origins.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { newListing, newUser, resetDatabase, SITE, startApp, type TestApp } from "./helpers.ts";

let t: TestApp;
let base = "";
before(async () => {
  await resetDatabase();
  t = await startApp();
  await t.app.deps.hub.start();
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  const addr = t.app.server.address() as { port: number };
  base = `ws://127.0.0.1:${addr.port}/api/v1/ws`;
});
after(async () => t?.close());

type Socket = { ws: WebSocket; events: any[]; closed: Promise<number>; waitFor: (pred: (e: any) => boolean, ms?: number) => Promise<any> };

function connect(headers: Record<string, string> = {}): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(base, { headers });
    const events: any[] = [];
    const waiters: { pred: (e: any) => boolean; resolve: (e: any) => void }[] = [];
    const closed = new Promise<number>((r) => ws.on("close", (code) => r(code)));
    ws.on("message", (data) => {
      const e = JSON.parse(String(data));
      events.push(e);
      for (const w of [...waiters]) if (w.pred(e)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(e);
      }
    });
    ws.on("open", () =>
      resolve({
        ws,
        events,
        closed,
        waitFor: (pred, ms = 3000) =>
          new Promise((res, rej) => {
            const hit = events.find(pred);
            if (hit) return res(hit);
            const timer = setTimeout(() => rej(new Error("timeout")), ms);
            waiters.push({ pred, resolve: (e) => (clearTimeout(timer), res(e)) });
          }),
      }),
    );
    ws.on("error", reject);
  });
}

describe("realtime", () => {
  test("messages reach both participants and nobody else", async () => {
    const seller = await newUser(t);
    const buyer = await newUser(t);
    const outsider = await newUser(t);
    const listing = await newListing(t, seller);
    const convo = await buyer.post("/api/v1/conversations", { listingId: listing.id });
    const cookie = (c: { cookies: Record<string, string> }) => ({ cookie: `kie_at=${c.cookies.kie_at}`, origin: SITE });
    const sSeller = await connect(cookie(seller));
    const sOutsider = await connect(cookie(outsider));
    await sSeller.waitFor((e) => e.type === "ready");
    await sOutsider.waitFor((e) => e.type === "ready");

    await buyer.post(`/api/v1/conversations/${convo.data.id}/messages`, { body: "Gizli mesaj" });
    const got = await sSeller.waitFor((e) => e.type === "message");
    assert.equal(got.message.body, "Gizli mesaj");
    assert.equal(got.conversationId, convo.data.id);
    const note = await sSeller.waitFor((e) => e.type === "notification");
    assert.match(note.notification.title, /mesaj/);
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(!sOutsider.events.some((e) => e.type === "message" || e.type === "notification"), "outsider received nothing");

    await seller.post(`/api/v1/conversations/${convo.data.id}/read`);
    await seller.post(`/api/v1/conversations/${convo.data.id}/meeting`);
    const conv = await sSeller.waitFor((e) => e.type === "conversation");
    assert.ok(conv.conversation.sellerConfirmedAt);
    sSeller.ws.close();
    sOutsider.ws.close();
  });

  test("unauthenticated sockets receive nothing and are closed", async () => {
    const s = await connect();
    s.ws.send(JSON.stringify({ type: "auth", token: "not-a-token" }));
    assert.equal(await s.closed, 4401);
    assert.equal(s.events.length, 0);
  });

  test("cookies from a foreign origin are ignored (cross-site WebSocket hijacking)", async () => {
    const u = await newUser(t);
    const s = await connect({ cookie: `kie_at=${u.cookies.kie_at}`, origin: "https://evil.example" });
    const code = await Promise.race([s.closed, new Promise<number>((r) => setTimeout(() => r(-1), 11_000))]);
    assert.equal(code, 4401);
    assert.ok(!s.events.some((e) => e.type === "ready"));
  });

  test("mobile clients authenticate with a first frame; signing out closes the socket", async () => {
    const u = await newUser(t);
    const login = await u.post("/api/v1/auth/login", { email: u.email, password: "Guclu-Sifre-2026", client: "mobile" });
    const s = await connect();
    s.ws.send(JSON.stringify({ type: "auth", token: login.data.accessToken }));
    await s.waitFor((e) => e.type === "ready");
    const m = { ...u, bearer: login.data.accessToken } as typeof u;
    Object.setPrototypeOf(m, Object.getPrototypeOf(u));
    m.cookies = {};
    await m.post("/api/v1/auth/logout");
    assert.equal(await s.closed, 4001);
  });
});
