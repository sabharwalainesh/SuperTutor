import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getGoBrowser } from '../../apps/web/src/lib/go-browser.js';

const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
test('desktop Chrome and Edge use their respective official stores', () => {
  assert.match(getGoBrowser(chrome).storeUrl!, /chromewebstore.google.com/);
  assert.match(getGoBrowser(`${chrome} Edg/140.0`).storeUrl!, /microsoftedge.microsoft.com/);
});
test('mobile and desktop-mode iPads never receive desktop extension instructions', () => {
  for (const ua of ['Android Chrome/140.0 Mobile', 'iPhone CriOS/140.0', 'iPad Safari/605']) assert.equal(getGoBrowser(ua).supported, false);
  assert.equal(getGoBrowser(chrome, 5).supported, false);
});
test('other browsers are not mistaken for supported Chrome', () => {
  for (const suffix of [' OPR/100', ' Vivaldi/7', ' Electron/40', ' HeadlessChrome/140']) assert.equal(getGoBrowser(chrome + suffix).supported, false);
  assert.equal(getGoBrowser(chrome, 0, undefined, true).supported, false);
  assert.equal(getGoBrowser(chrome, 0, [{ brand: 'Chromium' }]).supported, false);
  assert.equal(getGoBrowser('Firefox/140').supported, false);
  assert.equal(getGoBrowser('Safari/605').supported, false);
  assert.equal(getGoBrowser('').supported, false);
});
test('client hints distinguish supported branded browsers', () => {
  assert.equal(getGoBrowser(chrome, 0, [{ brand: 'Google Chrome' }]).name, 'Google Chrome');
  assert.equal(getGoBrowser(chrome, 0, [{ brand: 'Microsoft Edge' }]).name, 'Microsoft Edge');
});
