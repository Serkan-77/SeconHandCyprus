// Category attributes (shared/attributes.ts): inheritance, validation,
// display and URL filters. The API uses the same functions.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attributeFilterParams,
  effectiveAttributes,
  formatAttributeValue,
  highlightFacts,
  parseAttributeFilters,
  specificationGroups,
  validateAttributes,
} from "../shared/attributes.ts";

let id = 0;
const def = (categoryId, key, type, extra = {}) => ({
  id: ++id,
  categoryId,
  key,
  label: key,
  labelEn: null,
  type,
  unit: null,
  options: [],
  required: false,
  filterable: false,
  highlight: false,
  min: null,
  max: null,
  maxLength: null,
  placeholder: null,
  help: null,
  group: "Özellikler",
  sortOrder: 0,
  isActive: true,
  ...extra,
});
const opts = (...values) => values.map((v) => ({ value: v, label: v.toUpperCase() }));

const GLOBAL_BRAND = def(null, "brand", "text", { group: "Genel" });
const GLOBAL_BOX = def(null, "box", "boolean", { group: "Durum" });
const ELEC_WARRANTY = def(2, "warranty", "select", { options: opts("yes", "no") });
const PHONE_BRAND = def(10, "brand", "select", { options: opts("apple", "samsung"), required: true, filterable: true, highlight: true, group: "Genel" });
const PHONE_STORAGE = def(10, "storage_gb", "select", { options: [{ value: "128", label: "128 GB" }, { value: "256", label: "256 GB" }], filterable: true, highlight: true });
const PHONE_BATTERY = def(10, "battery", "number", { min: 1, max: 100, unit: "%", filterable: true });
const PHONE_HIDE_BOX = def(10, "box", "text", { isActive: false });
const ALL = [GLOBAL_BRAND, GLOBAL_BOX, ELEC_WARRANTY, PHONE_BRAND, PHONE_STORAGE, PHONE_BATTERY, PHONE_HIDE_BOX];

test("a category inherits global and ancestor attributes; lower definitions override or hide", () => {
  const phone = effectiveAttributes(ALL, [2, 10]);
  const keys = phone.map((d) => d.key);
  assert.ok(keys.includes("warranty"), "inherited from the parent");
  assert.equal(phone.find((d) => d.key === "brand").type, "select", "the child's brand replaces the global one");
  assert.ok(!keys.includes("box"), "hidden in this subtree");
  const electronics = effectiveAttributes(ALL, [2]);
  assert.equal(electronics.find((d) => d.key === "brand").type, "text");
  assert.ok(electronics.some((d) => d.key === "box"));
  assert.equal(phone[0].group, "Genel", "grouped in a fixed order");
});

test("validation: required, options, ranges, unknown keys, empty values", () => {
  const defs = effectiveAttributes(ALL, [2, 10]);
  assert.deepEqual(validateAttributes(defs, {}).errors.brand !== undefined, true);
  const { values, errors } = validateAttributes(defs, { brand: "apple", storage_gb: "256", battery: "88,5", warranty: "", evil: "<x>", box: true });
  assert.deepEqual(errors, {});
  assert.deepEqual(values, { brand: "apple", storage_gb: "256", battery: 88.5 });
  assert.ok(validateAttributes(defs, { brand: "nokia" }).errors.brand);
  assert.ok(validateAttributes(defs, { brand: "apple", battery: 101 }).errors.battery);
  assert.ok(validateAttributes(defs, { brand: "apple", battery: "abc" }).errors.battery);
  assert.ok(validateAttributes(defs, { brand: ["apple"] }).errors.brand);
});

test("text is collapsed and bounded; booleans store only true; years stay in range", () => {
  const defs = [def(null, "model", "text", { maxLength: 10 }), def(null, "charger", "boolean"), def(null, "year", "year")];
  assert.deepEqual(validateAttributes(defs, { model: "  iPhone   13 ", charger: false, year: "2020" }).values, { model: "iPhone 13", year: 2020 });
  assert.ok(validateAttributes(defs, { model: "x".repeat(11) }).errors.model);
  assert.ok(validateAttributes(defs, { year: 1800 }).errors.year);
  assert.ok(validateAttributes(defs, { year: new Date().getFullYear() + 5 }).errors.year);
  assert.ok(validateAttributes(defs, { year: 2020.5 }).errors.year);
});

test("display: option labels, units, booleans, grouped specification rows, card facts", () => {
  const defs = effectiveAttributes(ALL, [2, 10]);
  assert.equal(formatAttributeValue(PHONE_STORAGE, "128"), "128 GB");
  assert.equal(formatAttributeValue(PHONE_BATTERY, 88), "%88");
  assert.equal(formatAttributeValue(GLOBAL_BOX, true), "Var");
  assert.equal(formatAttributeValue(GLOBAL_BOX, false), null);
  const groups = specificationGroups(defs, { brand: "apple", storage_gb: "256", battery: 90 });
  assert.deepEqual(groups.map((g) => g.group), ["Genel", "Özellikler"]);
  assert.deepEqual(groups[0].rows, [{ key: "brand", label: "brand", value: "APPLE" }]);
  assert.deepEqual(highlightFacts(defs, { brand: "apple", storage_gb: "256" }), ["APPLE", "256 GB"]);
});

test("URL filters: only filterable attributes of the category, validated values, round trip", () => {
  const defs = effectiveAttributes(ALL, [2, 10]);
  const filters = parseAttributeFilters(defs, {
    "a.brand": "apple,huawei",
    "a.storage_gb": "256",
    "a.battery.min": "80",
    "a.battery.max": "x",
    "a.warranty": "yes",
    "a.sofa_type": "kanepe",
  });
  assert.deepEqual(
    [...filters].sort((a, b) => a.key.localeCompare(b.key)),
    [
      { key: "battery", kind: "range", min: 80, max: null },
      { key: "brand", kind: "in", values: ["apple"] },
      { key: "storage_gb", kind: "in", values: ["256"] },
    ],
  );
  assert.deepEqual(attributeFilterParams(filters), { "a.brand": "apple", "a.storage_gb": "256", "a.battery.min": "80" });
});
