const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../pro-unlock.html'), 'utf8');
const script = html.match(/<script>\s*\/\*[-\s]+Stripe[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');

function page({ failure, stored = new Map(), session = 'cs_test_fixture', tracker = true, privacy } = {}) {
  const calls = [];
  const nodes = new Map();
  const context = {
    URLSearchParams, location: { search: session ? '?session_id=' + session : '' },
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); },
      createElement() { return {}; }, head: { appendChild() {} } },
    localStorage: {
      getItem(key) { if (failure === 'get') throw Error('denied'); return stored.get(key) || null; },
      setItem(key, value) { if (failure === 'set') throw Error('quota'); stored.set(key, value); }
    },
    navigator: { doNotTrack: privacy === 'dnt' ? '1' : '0' },
    fetch() { return new Promise(() => {}); }, setTimeout() {},
  };
  context.window = context;
  if (tracker) context.trackEvent = (...args) => calls.push(args);
  vm.createContext(context);
  if (privacy) {
    if (privacy === 'optout') stored.set('menufitsAnalyticsOptOut', '1');
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../analytics.js'), 'utf8'), context);
  }
  vm.runInContext(script, context);
  return { context, calls, nodes, stored, ready() { context.showReady('fixture-license'); } };
}

for (const failure of [undefined, 'get', 'set']) {
  test('purchase once per page with storage ' + (failure || 'available'), () => {
    const p = page({ failure }); p.ready(); p.ready();
    assert.equal(p.calls.length, 1);
    const [event, payload] = p.calls[0];
    assert.equal(event, 'purchase');
    // session_id はそれだけでキーを取り出せるので、GA には戻せない値で送る
    assert.match(payload.transaction_id, /^mf_[0-9a-f]{16}$/);
    assert.ok(!payload.transaction_id.includes('cs_test_fixture'));
    assert.equal(payload.value, 1480);
    assert.equal(payload.currency, 'JPY');
    assert.equal(payload.items[0].item_id, 'menufits_pro');
    assert.equal(p.nodes.get('ready').hidden, false);
    assert.equal(p.nodes.get('keyval').textContent, 'fixture-license');
  });
}
test('persisted marker prevents purchase on reload', () => {
  const p = page(); p.ready(); const reloaded = page({ stored: p.stored }); reloaded.ready();
  assert.equal(reloaded.calls.length, 0);
});
test('missing session sends nothing', () => { const p = page({ session: '' }); p.ready(); assert.equal(p.calls.length, 0); });
test('missing tracker does not mark an unattempted event', () => {
  const p = page({ tracker: false }); p.ready();
  assert.equal(p.stored.has('menufitsPurchaseTracked:cs_test_fixture'), false);
  p.context.trackEvent = (...args) => p.calls.push(args); p.ready(); assert.equal(p.calls.length, 1);
});
for (const privacy of ['dnt', 'optout']) test(privacy + ' remains respected by analytics wrapper', () => {
  const p = page({ privacy }); p.ready(); assert.equal(p.context.dataLayer, undefined);
});
