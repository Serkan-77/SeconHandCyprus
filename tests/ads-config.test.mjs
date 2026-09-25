// P1-14: ads are served only after the consent (CMP) step is confirmed.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

let n = 0;
async function load(env) {
  for (const key of ["NEXT_PUBLIC_ADSENSE_CLIENT", "NEXT_PUBLIC_ADSENSE_CMP_READY"]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  // A fresh module instance per case: ads.ts reads the environment on import.
  return import(`../src/lib/ads.ts?case=${n++}`);
}

const CLIENT = "ca-pub-1234567890123456";

test("nothing without a valid client id", async () => {
  for (const env of [{}, { NEXT_PUBLIC_ADSENSE_CLIENT: "pub-123" }, { NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-12", NEXT_PUBLIC_ADSENSE_CMP_READY: "1" }]) {
    const ads = await load(env);
    assert.equal(ads.adsenseConfigured, false);
    assert.equal(ads.adsEnabled, false);
  }
});

test("client id alone: site-review only (meta tag + ads.txt), no ads", async () => {
  const ads = await load({ NEXT_PUBLIC_ADSENSE_CLIENT: CLIENT });
  assert.equal(ads.adsenseConfigured, true);
  assert.equal(ads.adsEnabled, false);
  const notOne = await load({ NEXT_PUBLIC_ADSENSE_CLIENT: CLIENT, NEXT_PUBLIC_ADSENSE_CMP_READY: "true" });
  assert.equal(notOne.adsEnabled, false);
});

test("ads only with the client id and an explicit CMP confirmation", async () => {
  const ads = await load({ NEXT_PUBLIC_ADSENSE_CLIENT: CLIENT, NEXT_PUBLIC_ADSENSE_CMP_READY: "1" });
  assert.equal(ads.adsenseConfigured, true);
  assert.equal(ads.adsEnabled, true);
});
