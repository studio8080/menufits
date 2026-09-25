// 購入完了ページの session_id は、それだけで購入から30日間ライセンスキーを取り出せる。
// 解析（GA4）へ生のまま送っていないことを確かめる。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const SESSION = 'cs_live_a1SECRETfixture000';

function loaderCalls(src, href) {
  const u = new URL(href);
  const c = {
    URL, location: { href, search: u.search },
    navigator: { doNotTrack: '0' }, localStorage: { getItem: () => null, setItem() {} },
    document: { documentElement: { lang: 'ja' }, createElement: () => ({}), head: { appendChild() {} } },
  };
  c.window = c; vm.createContext(c); vm.runInContext(src, c);
  return c.dataLayer.map(a => [...a]);
}
const loaders = [
  ['analytics.js', read('analytics.js')],
  ['index.html inline loader', read('index.html').match(/<script>([\s\S]*?)<\/script>/)[1]],
];

for (const [name, src] of loaders) {
  test(name + ': session_id never reaches page_location', () => {
    const href = 'https://menufits.kokokikaku.com/pro-unlock.html?session_id=' + SESSION + '&x=1';
    const calls = loaderCalls(src, href);
    const config = calls.find(a => a[0] === 'config');
    assert.ok(config[2].page_location, 'page_location must be set explicitly');
    assert.ok(!JSON.stringify(calls).includes(SESSION), 'the raw session id must not be sent');
    assert.match(config[2].page_location, /session_id=redacted/);
    assert.match(config[2].page_location, /[?&]x=1/, 'other parameters are kept');
    assert.equal(config[2].anonymize_ip, true);
  });

  test(name + ': ordinary pages keep the default page_location', () => {
    const calls = loaderCalls(src, 'https://menufits.kokokikaku.com/?lang=en');
    const config = calls.find(a => a[0] === 'config');
    assert.equal(config[2].page_location, undefined);
  });
}

for (const page of ['pro-unlock.html', 'en/pro-unlock.html']) {
  test(page + ': transaction_id is a one-way value, stable per session', () => {
    const src = read(page).match(/<script>\s*\/\*[-\s]+Stripe[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
    const run = session => {
      const calls = [];
      const c = {
        URLSearchParams, location: { search: '?session_id=' + session, href: '' },
        document: { getElementById() { return {}; } },
        localStorage: { getItem: () => null, setItem() {} },
        fetch() { return new Promise(() => {}); }, setTimeout() {},
        trackEvent: (...a) => calls.push(a),
      };
      c.window = c; vm.createContext(c); vm.runInContext(src, c);
      c.showReady('MNPRO-TEST');
      return calls[0][1].transaction_id;
    };
    const a = run(SESSION), b = run(SESSION), other = run(SESSION + 'x');
    assert.match(a, /^mf_[0-9a-f]{16}$/);
    assert.ok(!a.includes('cs_live'));
    assert.equal(a, b, 'same session → same id (GA dedup still works)');
    assert.notEqual(a, other);
  });
}
