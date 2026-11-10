import { test } from 'node:test';
import assert from 'node:assert/strict';
import { de, en, detectLanguage, formatMean, interpolate } from '../shared/i18n.js';
test('English and German dictionaries have identical nonempty keys and interpolation tokens', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
  assert.deepEqual(Object.keys(en.errors).sort(), Object.keys(de.errors).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) {
    if (key === 'errors') continue;
    assert.ok(en[key].length && de[key].length);
    assert.deepEqual(en[key].match(/\{\w+\}/g), de[key].match(/\{\w+\}/g));
  }
});
test('primary browser language and stored preference', () => {
  assert.equal(detectLanguage(null, ['de-DE', 'en-US']), 'de');
  assert.equal(detectLanguage(null, ['de-AT']), 'de');
  assert.equal(detectLanguage(null, ['fr-FR', 'de-DE']), 'en');
  assert.equal(detectLanguage(null, []), 'en');
  assert.equal(detectLanguage('en', ['de-DE']), 'en');
  assert.equal(detectLanguage('de', ['en-US']), 'de');
  assert.equal(detectLanguage('invalid', ['de-DE']), 'de');
});
test('localized means never exceed two decimals and do not add zeros', () => {
  assert.equal(formatMean(4.5, 'en'), '4.5'); assert.equal(formatMean(4.5, 'de'), '4,5');
  assert.equal(formatMean(10, 'de'), '10'); assert.equal(formatMean(3.666666, 'en'), '3.67');
  assert.equal(interpolate(de.missing, { count: 2 }), '2 Stimmen fehlen noch');
});
