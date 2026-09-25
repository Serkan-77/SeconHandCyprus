import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteOwnAccount, removeOwnFiles, RESTRICTED_MESSAGE } from "../src/lib/accountDeletion.ts";

const USER = "11111111-1111-1111-1111-111111111111";

function fakeClient({ files = {}, sanctioned = false, rpcError = null, listError = null } = {}) {
  const calls = [];
  const buckets = Object.fromEntries(Object.entries(files).map(([b, names]) => [b, [...names]]));
  return {
    calls,
    buckets,
    rpc(fn, args) {
      calls.push(["rpc", fn, args]);
      if (fn === "is_sanctioned") return Promise.resolve({ data: sanctioned, error: null });
      return Promise.resolve({ data: null, error: rpcError });
    },
    storage: {
      from(bucket) {
        const names = (buckets[bucket] ??= []);
        return {
          async list(path, { limit, offset }) {
            calls.push(["list", bucket, path]);
            if (listError) return { data: null, error: { message: listError } };
            return { data: names.slice(offset, offset + limit).map((name) => ({ name })), error: null };
          },
          async remove(paths) {
            calls.push(["remove", bucket, paths]);
            for (const p of paths) {
              assert.ok(p.startsWith(`${USER}/`), `outside own folder: ${p}`);
              names.splice(names.indexOf(p.slice(USER.length + 1)), 1);
            }
            return { error: null };
          },
        };
      },
    },
  };
}

test("removes every file in the user's folders, across pages", async () => {
  const many = Array.from({ length: 230 }, (_, i) => `${i}.jpg`);
  const client = fakeClient({ files: { "listing-images": many, avatars: ["a.png"] } });
  const result = await removeOwnFiles(client, USER);
  assert.equal(result.removed, 231);
  assert.equal(client.buckets["listing-images"].length, 0);
  assert.equal(client.buckets.avatars.length, 0);
  assert.ok(client.calls.every(([kind, , path]) => kind !== "list" || path === USER), "listed another folder");
});

test("files first, then the account", async () => {
  const client = fakeClient({ files: { "listing-images": ["x.jpg"] } });
  assert.deepEqual(await deleteOwnAccount(client, USER), { ok: true });
  const order = client.calls.map(([kind, name]) => `${kind}:${name}`);
  assert.ok(order.indexOf("remove:listing-images") < order.indexOf("rpc:delete_my_account"));
});

test("restricted accounts keep their files and account", async () => {
  const client = fakeClient({ files: { "listing-images": ["x.jpg"] }, sanctioned: true });
  assert.deepEqual(await deleteOwnAccount(client, USER), { error: RESTRICTED_MESSAGE });
  assert.equal(client.buckets["listing-images"].length, 1);
  assert.ok(!client.calls.some(([, fn]) => fn === "delete_my_account"));
});

test("a Storage failure stops before the account is deleted", async () => {
  const client = fakeClient({ listError: "storage down" });
  const result = await deleteOwnAccount(client, USER);
  assert.match(result.error, /silinemedi/);
  assert.ok(!client.calls.some(([, fn]) => fn === "delete_my_account"));
});

test("the database's refusal reaches the user", async () => {
  const client = fakeClient({ rpcError: { code: "PT403", message: "Hesabın kısıtlıyken silinemez." } });
  assert.deepEqual(await deleteOwnAccount(client, USER), { error: "Hesabın kısıtlıyken silinemez." });
});
