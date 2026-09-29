import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { translate, parseLocale } from '../src/lib/i18n/translate.ts';
import { formatLocalized } from '../src/lib/i18n/format.ts';
import { inventory } from '../scripts/i18n-inventory.mjs';

test('Turkish UI copy has an English catalog entry across all routes and shared modules', () => {
  const unchanged = new Set(['SİL', 'İkinci Elcim', 'Türkçeye geç', 'Lefkoşa', 'Gazimağusa', 'Güzelyurt', 'İskele', 'Kıbrıs İkinci Elcim']);
  const missing = inventory().filter(key => /[çğıöşüÇĞİÖŞÜ]/.test(key) && !unchanged.has(key) && translate(key, 'en') === key);
  assert.deepEqual(missing, []);
});

test('locale validation, whitespace, fallback and both directions', () => {
  assert.equal(parseLocale('en'), 'en');
  for (const value of ['tr', 'fr', '', undefined, null]) assert.equal(parseLocale(value), 'tr');
  assert.equal(translate('  Giriş yap\n', 'en'), '  Sign in\n');
  assert.equal(translate('Giriş yap', 'tr'), 'Giriş yap');
  for (const value of ['Personal listing text', 'constructor', '__proto__', 'toString', '']) assert.equal(translate(value, 'en'), value);
});

test('interpolation preserves user text and supports reordered parameters', () => {
  assert.equal(translate('3 gün önce', 'en'), '3 days ago');
  assert.equal(translate('Fotoğraf 2 / 10', 'en'), 'Photo 2 / 10');
  assert.equal(translate('2026\'dan beri üye', 'en'), 'Member since 2026');
  assert.equal(translate('Mobilya ilanını aç', 'en'), 'Open listing: Mobilya');
  assert.equal(translate('Başlık en az 3 karakter olmalı.', 'en'), 'The title must be at least 3 characters.');
  assert.equal(translate('Yorum en az 5 karakter olmalı.', 'en'), 'Comment must be at least 5 characters.');
});

test('numbers, money, dates and relative labels follow the selected locale', () => {
  assert.equal(formatLocalized('formatPrice', [12500, 'EUR'], 'tr'), '12.500 EUR');
  assert.equal(formatLocalized('formatPrice', [12500, 'EUR'], 'en'), '12,500 EUR');
  assert.equal(formatLocalized('formatLongDate', ['2026-09-29T12:00:00Z'], 'en'), '29 September 2026');
  assert.equal(formatLocalized('memberSince', ['2026-01-01T12:00:00Z'], 'en'), 'Member since 2026');
  assert.equal(formatLocalized('ratingLabel', [4.5, 1], 'en'), '★ 4.5 (1 review)');
});

// Exercise the real React components with SSR. Only Next's link/image adapters
// are stubbed, because these tests target localization and form semantics.
const require = createRequire(import.meta.url);
function loadComponent(path, dependencies) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const compiled = { exports: {} };
  const resolver = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function('require', 'module', 'exports', outputText)(resolver, compiled, compiled.exports);
  return compiled.exports;
}
const provider = loadComponent('../src/components/i18n/LocaleProvider.tsx', {
  '@/lib/i18n/translate': { translate, LOCALE_COOKIE: 'kie-locale' },
});
const localized = loadComponent('../src/components/i18n/Localized.tsx', {
  './LocaleProvider': provider,
  '@/lib/i18n/format': { formatLocalized },
  'next/link': props => React.createElement('a', props),
  'next/image': props => React.createElement('img', props),
});
const render = (locale, children) => renderToStaticMarkup(React.createElement(provider.LocaleProvider, { initialLocale: locale }, children));

test('SSR translates labels and accessibility props but preserves form values', () => {
  const html = render('en', React.createElement('div', null,
    React.createElement(localized.input, { 'aria-label': 'Başlık', placeholder: 'İlan başlığı', defaultValue: 'Mobilya' }),
    React.createElement('select', { name: 'condition' }, React.createElement(localized.option, null, 'Az kullanılmış')),
    React.createElement(localized.button, { title: 'Kaydet' }, 'Kaydet'),
  ));
  assert.match(html, /aria-label="Title"/);
  assert.match(html, /placeholder="Listing title"/);
  assert.match(html, /value="Mobilya"/);
  assert.match(html, /value="Az kullanılmış">Lightly used<\/option>/);
  assert.match(html, /title="Save">Save<\/button>/);
});

test('user content and rich fragments remain intact while UI text translates', () => {
  const html = render('en', React.createElement(localized.p, null,
    React.createElement(React.Fragment, null, 'Kaydet'),
    React.createElement(localized.Raw, null, 'Mobilya'),
    React.createElement(localized.span, { translate: 'no' }, 'Giriş yap'),
  ));
  assert.equal(html, '<p>SaveMobilya<span translate="no">Giriş yap</span></p>');
});
