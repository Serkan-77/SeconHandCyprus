// Regression tests for P0-01 (stored XSS through JSON-LD).
//
//   npm test
//
// Renders the exact <script> props the JsonLd component uses with React's
// server renderer and checks that user-written text cannot close the tag.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { jsonLdScriptProps, serializeJsonLd } from "../src/lib/jsonLd.ts";

const PAYLOAD = "</script><script>alert(1)</script>";

function render(data) {
  return renderToStaticMarkup(createElement("script", jsonLdScriptProps(data)));
}

/** The JSON inside the rendered <script>…</script>. */
function innerJson(html) {
  const open = '<script type="application/ld+json">';
  assert.ok(html.startsWith(open), `unexpected markup: ${html.slice(0, 80)}`);
  assert.ok(html.endsWith("</script>"));
  return html.slice(open.length, -"</script>".length);
}

function assertSafe(html) {
  // Only the element's own closing tag may appear, once, at the very end.
  assert.equal(html.split("</script").length - 1, 1, "stray </script in output");
  const inner = innerJson(html);
  for (const char of ["<", ">", "&", "\u2028", "\u2029"]) {
    assert.ok(!inner.includes(char), `raw ${JSON.stringify(char)} left in JSON-LD`);
  }
  assert.ok(!/<!--|<script/i.test(inner));
}

// Same shapes as src/app/ilan/[slug]/page.tsx, Breadcrumbs.tsx and ListingsResults.tsx.
function productFor({ title, description, seller }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description,
    offers: {
      "@type": "Offer",
      price: 750,
      priceCurrency: "TRY",
      seller: { "@type": "Person", name: seller, url: "https://example.test/satici/1" },
    },
  };
}

function breadcrumbsFor(labels) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: ["Ana sayfa", ...labels].map((name, i) => ({ "@type": "ListItem", position: i + 1, name })),
  };
}

test("serializer writes the payload as \\u003c escapes and keeps valid JSON", () => {
  const json = serializeJsonLd({ name: PAYLOAD });
  assert.ok(!json.includes("</script>"));
  assert.ok(json.includes("\\u003c/script\\u003e"), "expected literal \\u003c in the output");
  assert.deepEqual(JSON.parse(json), { name: PAYLOAD });
});

test("<, >, &, U+2028 and U+2029 are all escaped", () => {
  const value = "a<b>c&d\u2028e\u2029f";
  const json = serializeJsonLd({ value });
  assert.equal(json, '{"value":"a\\u003cb\\u003ec\\u0026d\\u2028e\\u2029f"}');
  assert.deepEqual(JSON.parse(json), { value });
});

test("listing title payload cannot break out of the Product JSON-LD", () => {
  const data = productFor({ title: PAYLOAD, description: "Temiz", seller: "Ece" });
  const html = render(data);
  assertSafe(html);
  assert.deepEqual(JSON.parse(innerJson(html)), data);
});

test("listing description payload cannot break out of the Product JSON-LD", () => {
  const description = `Güzel lamba ${PAYLOAD} <!-- & "tırnak" \u2028 son`;
  const data = productFor({ title: "Lamba", description, seller: "Ece" });
  const html = render(data);
  assertSafe(html);
  assert.equal(JSON.parse(innerJson(html)).description, description);
});

test("seller display name payload cannot break out of Product or BreadcrumbList", () => {
  const seller = `Ece ${PAYLOAD}`;
  for (const data of [
    productFor({ title: "Lamba", description: "Temiz", seller }),
    breadcrumbsFor([seller, "Değerlendirmeler"]),
  ]) {
    const html = render(data);
    assertSafe(html);
    assert.deepEqual(JSON.parse(innerJson(html)), data);
  }
});

test("breadcrumb and results list (array data) stay safe", () => {
  const data = [
    breadcrumbsFor(["Mobilya", PAYLOAD]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: PAYLOAD }],
    },
  ];
  const html = render(data);
  assertSafe(html);
  assert.deepEqual(JSON.parse(innerJson(html)), data);
});

test("ordinary Turkish text is unchanged", () => {
  const data = { name: "Ahşap berjer — çok az kullanılmış, İskele" };
  assert.equal(serializeJsonLd(data), JSON.stringify(data));
});
