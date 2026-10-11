const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const loader = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const opening = html.slice(html.indexOf('let menuEditorOpened='), html.indexOf('function showLP()'));

function app({ privacy = 'enabled', english = false, trackerFails = false } = {}) {
  const classes = new Set(['lp-mode']); let fits = 0;
  const c = { URL, location: { href: 'https://example.com/?private=never-send', search: '' },
    EN: english, navigator: { doNotTrack: privacy === 'dnt' ? '1' : '0' },
    localStorage: { getItem: k => k === 'menufitsAnalyticsOptOut' && privacy === 'optout' ? '1' : null },
    document: { createElement: () => ({}), head: { appendChild() {} },
      body: { classList: { remove: s => classes.delete(s), add: s => classes.add(s) } } },
    fit() { fits++; } };
  c.window = c; vm.createContext(c); vm.runInContext(loader, c);
  if (trackerFails) c.trackEvent = () => { throw Error('blocked analytics'); };
  vm.runInContext(opening, c);
  return { c, classes, fits: () => fits,
    events: () => Array.from(c.dataLayer || []).filter(a => a[0] === 'event').map(a => Array.from(a)) };
}
for (const english of [false, true]) for (const privacy of ['enabled', 'optout', 'dnt']) {
  test(`one editor opening per page; language=${english}; privacy=${privacy}`, () => {
    const a = app({ english, privacy });
    a.c.showApp('sample_link'); a.c.showApp('landing');
    assert.ok(a.classes.has('app-mode')); assert.ok(!a.classes.has('lp-mode'));
    assert.equal(a.fits(), 2);
    const events = a.events(); assert.equal(events.length, privacy === 'enabled' ? 1 : 0);
    if (events.length) {
      assert.equal(events[0][1], 'menu_editor_open');
      assert.equal(events[0][2].entry, 'sample_link');
      assert.equal(events[0][2].ui_lang, english ? 'en' : 'ja');
    }
    assert.ok(!JSON.stringify(events).includes('private'));
  });
}
test('unknown source cannot transmit user data', () => {
  const a = app(); a.c.showApp('private shop name');
  assert.equal(a.events()[0][2].entry, 'direct');
  assert.ok(!JSON.stringify(a.events()).includes('private shop name'));
});
test('analytics failure leaves the editor usable', () => {
  const a = app({ trackerFails: true });
  assert.doesNotThrow(() => a.c.showApp('landing'));
  assert.ok(a.classes.has('app-mode')); assert.equal(a.fits(), 1);
});
