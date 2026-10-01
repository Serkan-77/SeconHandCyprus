// Application-level checks after an import rehearsal: the real API, running
// against the imported database, must behave for the imported accounts.
//
//   node migration/rehearsal/app-check.mjs http://127.0.0.1:4400
//
// Uses the rehearsal accounts from 10-seed.sql (fake data). Exit 1 on failure.
const base = (process.argv[2] ?? "http://127.0.0.1:4400").replace(/\/$/, "");
const PASSWORD = "rehearsal-pass-1";
let failed = 0;

const check = (label, cond, extra = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failed++;
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-kie-csrf": "1",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

const login = (email, password = PASSWORD) => call("POST", "/auth/login", { body: { email, password, client: "mobile" } });

console.log("accounts");
const seller = await login("Satici.Bir@Rehearsal.test"); // mixed case as stored in Supabase
check("bcrypt account signs in (case-insensitive e-mail)", seller.status === 200 && !!seller.json?.accessToken, `HTTP ${seller.status}`);
const again = await login("satici.bir@rehearsal.test");
check("signs in again after the Argon2id rehash", again.status === 200);
check("wrong password refused", (await login("satici.bir@rehearsal.test", "wrong-pass-1")).status === 401);
check("Google-only account has no password", (await login("google.user@rehearsal.test")).status === 401);
const unconfirmed = await login("unconfirmed@rehearsal.test");
check("unconfirmed e-mail must verify first", unconfirmed.status === 403 && unconfirmed.json?.error?.code === "email_not_verified", `HTTP ${unconfirmed.status}`);
const admin = await login("admin@rehearsal.test");
check("admin signs in", admin.status === 200);

const st = seller.json?.accessToken;
const at = admin.json?.accessToken;

console.log("listings");
const detail = await call("GET", "/listings/ikea-koltuk-100001");
const l = detail.json?.listing ?? detail.json;
check("listing by its old URL slug", detail.status === 200, `HTTP ${detail.status}`);
check("photos imported in order", l?.images?.length === 2 && /\/media\/l\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/md\.webp$/.test(l.images[0]?.urls?.md ?? ""), l?.images?.[0]?.id);
check("first photo is the original first photo", l?.images?.[0]?.id === "20000000-0000-4000-a000-000000000001" && l?.images?.[0]?.width === 1600);
const json = JSON.stringify(detail.json ?? {});
check("legacy details shown as attributes", json.includes("IKEA") && json.includes("Kivik"));
if (l?.images?.[0]?.urls?.md) {
  const media = await fetch(`${base}${l.images[0].urls.md}`);
  check("image served", media.status === 200 && media.headers.get("content-type") === "image/webp", `HTTP ${media.status}`);
}
const search = await call("GET", "/listings?kategori=mobilya");
const owner = await call("GET", "/listings/cim-bicme-100004", { token: (await login("magaza@rehearsal.test")).json?.accessToken });
check("owner still sees their pending listing", owner.status === 200, `HTTP ${owner.status}`);
const coll = await call("GET", "/listings/eski-para-koleksiyonu-100003");
check("admin-added category mapped", coll.json?.listing?.category?.slug === "koleksiyon", coll.json?.listing?.category?.slug);
check("search finds imported active listing", JSON.stringify(search.json ?? {}).includes("100001"), `HTTP ${search.status}`);
check("pending listing not public", (await call("GET", "/listings/cim-bicme-100004")).status === 404);
check("rejected listing not public", (await call("GET", "/listings/reddedilen-100005")).status === 404);

console.log("messages and ratings");
const both = await login("both@rehearsal.test");
const conv = await call("GET", "/conversations", { token: both.json?.accessToken });
const list = conv.json?.conversations ?? [];
check("buyer sees their conversation", list.some((c) => c.id === "30000000-0000-4000-a000-000000000001"), `HTTP ${conv.status}, ${list.length}`);
const msgs = await call("GET", "/conversations/30000000-0000-4000-a000-000000000001/messages", { token: both.json?.accessToken });
check("message history intact", (msgs.json?.messages ?? []).length === 2, `HTTP ${msgs.status}`);
const outsider = await call("GET", "/conversations/30000000-0000-4000-a000-000000000001/messages", { token: admin.json?.accessToken });
check("non-participant cannot read it (RLS)", outsider.status === 404 || outsider.status === 403 || (outsider.json?.messages ?? []).length === 0, `HTTP ${outsider.status}`);
const dup = await call("POST", "/conversations/30000000-0000-4000-a000-000000000001/rating", { token: both.json?.accessToken, body: { score: 5 } });
check("second rating for the same deal refused", dup.status >= 400 && dup.status < 500, `HTTP ${dup.status}`);

console.log("admin");
const dash = await call("GET", "/admin/dashboard", { token: at });
check("admin dashboard", dash.status === 200, `HTTP ${dash.status}`);
check("normal user refused from admin", (await call("GET", "/admin/dashboard", { token: st })).status === 403);
const suspended = await call("GET", "/admin/users/00000000-0000-4000-a000-000000000004", { token: at });
check("sanction state preserved", JSON.stringify(suspended.json ?? {}).includes("suspended"), `HTTP ${suspended.status}`);

console.log(failed ? `\nFAILED: ${failed} check(s)` : "\nOK: application checks passed");
process.exit(failed ? 1 : 0);
