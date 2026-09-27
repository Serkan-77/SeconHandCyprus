// Listing details and store profiles (migration 0014).
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { listingCreateSchema, listingDetailsSchema, storeSchema } from "../src/lib/validation.ts";
import { detailRows } from "../src/lib/listingDetails.ts";

test("empty details are dropped, filled ones kept", () => {
  const parsed = listingDetailsSchema.parse({
    brand: "  IKEA ",
    model: "",
    color: undefined,
    year: "2021",
    warranty: "",
    invoice: false,
    box: true,
    delivery: ["Elden teslim", "Elden teslim"],
  });
  assert.deepEqual(parsed, { brand: "IKEA", year: 2021, box: true, delivery: ["Elden teslim"] });
  assert.deepEqual(listingDetailsSchema.parse({}), {});
});

test("details reject unknown options and impossible years", () => {
  assert.equal(listingDetailsSchema.safeParse({ year: 1800 }).success, false);
  assert.equal(listingDetailsSchema.safeParse({ year: new Date().getFullYear() + 1 }).success, false);
  assert.equal(listingDetailsSchema.safeParse({ warranty: "Ömür boyu" }).success, false);
  assert.equal(listingDetailsSchema.safeParse({ delivery: ["Işınlama"] }).success, false);
  assert.equal(listingDetailsSchema.safeParse({ brand: "x".repeat(61) }).success, false);
});

test("a listing without details still validates", () => {
  const base = {
    title: "Ahşap berjer",
    categorySlug: "mobilya",
    condition: "Az kullanılmış",
    description: "",
    price: "1500",
    currency: "TL",
    city: "Girne",
    negotiable: false,
    photos: ["u/1.jpg"],
    submissionKey: "7d3f3c1e-2b1a-4c5d-9e8f-0a1b2c3d4e5f",
  };
  assert.equal(listingCreateSchema.safeParse(base).success, true);
  const withDetails = listingCreateSchema.parse({ ...base, details: { exchange: true } });
  assert.deepEqual(withDetails.details, { exchange: true });
});

test("detail rows follow a fixed order and skip unset fields", () => {
  assert.deepEqual(detailRows({ delivery: ["Kargo ile gönderim"], brand: "Apple", invoice: true }), [
    ["Marka", "Apple"],
    ["Fatura", "Faturası var"],
    ["Teslimat", "Kargo ile gönderim"],
  ]);
  assert.deepEqual(detailRows(null), []);
});

test("store profile: name required, optional fields become null", () => {
  const parsed = storeSchema.parse({ storeName: " Girne Mobilya ", address: "", phone: "", website: "", hours: "" });
  assert.deepEqual(parsed, { storeName: "Girne Mobilya", address: null, phone: null, website: null, hours: null });
  assert.equal(storeSchema.safeParse({ storeName: "x", address: "", phone: "", website: "", hours: "" }).success, false);
});

test("store website gets a scheme and phone is checked", () => {
  const parsed = storeSchema.parse({ storeName: "Dükkan", address: "", phone: "+90 533 123 45 67", website: "ornek.com", hours: "" });
  assert.equal(parsed.website, "https://ornek.com");
  assert.equal(parsed.phone, "+905331234567");
  assert.equal(storeSchema.safeParse({ storeName: "Dükkan", address: "", phone: "123", website: "", hours: "" }).success, false);
  assert.equal(storeSchema.safeParse({ storeName: "Dükkan", address: "", phone: "", website: "not a url", hours: "" }).success, false);
});
