const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const html = read('index.html');
const head = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// <head> 先頭のスクリプト（表示言語＋解析ローダー）を、指定の条件で動かす
function run({ search = '', stored = {}, storageThrows = false, dnt = '0' } = {}) {
  const store = new Map(Object.entries(stored)), calls = [];
  const c = {
    location: { search },
    navigator: { doNotTrack: dnt },
    localStorage: {
      getItem(k) { if (storageThrows) throw Error('denied'); return store.has(k) ? store.get(k) : null; },
      setItem(k, v) { if (storageThrows) throw Error('denied'); store.set(k, v); },
    },
    document: { documentElement: {}, createElement: () => ({}), head: { appendChild() {} } },
  };
  c.window = c; vm.createContext(c);
  vm.runInContext(head, c);
  (c.dataLayer || []).forEach(a => calls.push([...a]));
  return { c, store, calls };
}

test('defaults to Japanese and leaves the page untouched', () => {
  const { c, store } = run();
  assert.equal(c.MENUFITS_LANG, 'ja');
  assert.equal(c.T('日本語', 'English'), '日本語');
  assert.equal(c.document.documentElement.lang, undefined);
  assert.equal(store.has('menufitsLang'), false);
});

test('?lang=en switches to English and remembers it', () => {
  const { c, store } = run({ search: '?lang=en' });
  assert.equal(c.MENUFITS_LANG, 'en');
  assert.equal(c.T('日本語', 'English'), 'English');
  assert.equal(c.document.documentElement.lang, 'en');
  assert.equal(store.get('menufitsLang'), 'en');
});

test('the remembered language applies without a parameter, and ?lang=ja overrides it', () => {
  assert.equal(run({ stored: { menufitsLang: 'en' } }).c.MENUFITS_LANG, 'en');
  const back = run({ search: '?x=1&lang=ja', stored: { menufitsLang: 'en' } });
  assert.equal(back.c.MENUFITS_LANG, 'ja');
  assert.equal(back.store.get('menufitsLang'), 'ja');
});

test('unknown values and blocked storage fall back to Japanese', () => {
  assert.equal(run({ search: '?lang=fr' }).c.MENUFITS_LANG, 'ja');
  assert.equal(run({ search: '?lang=english' }).c.MENUFITS_LANG, 'ja');
  assert.equal(run({ storageThrows: true }).c.MENUFITS_LANG, 'ja');
  // 保存できなくても、パラメータがあればそのページは英語で出す
  assert.equal(run({ search: '?lang=en', storageThrows: true }).c.MENUFITS_LANG, 'en');
});

for (const [name, src] of [['index.html inline loader', null], ['analytics.js', read('analytics.js')]]) {
  test(name + ': consent is denied by default for EEA/UK/CH before config, with ui_lang', () => {
    let calls;
    if (src) {
      const c = { navigator: { doNotTrack: '0' }, localStorage: { getItem: () => null },
        document: { documentElement: { lang: 'en' }, createElement: () => ({}), head: { appendChild() {} } } };
      c.window = c; vm.createContext(c); vm.runInContext(src, c);
      calls = c.dataLayer.map(a => [...a]);
    } else {
      calls = run({ search: '?lang=en' }).calls;
    }
    const iConsent = calls.findIndex(a => a[0] === 'consent' && a[1] === 'default');
    const iConfig = calls.findIndex(a => a[0] === 'config');
    assert.ok(iConsent >= 0 && iConsent < iConfig, 'consent default must come before config');
    const region = calls[iConsent][2].region;
    for (const cc of ['DE', 'FR', 'IE', 'GB', 'CH', 'NO']) assert.ok(region.includes(cc), cc);
    assert.ok(!region.includes('JP') && !region.includes('US'));
    assert.equal(calls[iConsent][2].analytics_storage, 'denied');
    const up = calls.find(a => a[0] === 'set' && a[1] === 'user_properties');
    assert.equal(up[2].ui_lang, 'en');
  });
}

test('English UI never falls back to the yen payment link', () => {
  assert.match(html, /const proPurchaseUrl=\(\)=>EN\?PRO_PURCHASE_URL_EN:PRO_PURCHASE_URL;/);
  assert.doesNotMatch(html, /location\.href=PRO_PURCHASE_URL;/);
});

test('English samples use the same keys as the Japanese ones', () => {
  const keys = src => [...src.matchAll(/^  (\w+):\{$/gm)].map(m => m[1]);
  const ja = html.slice(html.indexOf('const SAMPLES = {'), html.indexOf('SAMPLES.blank = {'));
  const en = html.slice(html.indexOf('const SAMPLES_EN = {'), html.indexOf('if(EN){ SAMPLES.washokuJa'));
  assert.deepEqual(keys(en).sort(), keys(ja).sort());
});

test('en/pro-unlock.html records a US$19 purchase once and returns to the English editor', () => {
  const page = read('en/pro-unlock.html');
  const script = page.match(/<script>\s*\/\*[-\s]+Stripe[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');
  // 日本語版と処理がずれていないこと（文言・金額・戻り先以外は同じ）
  const ja = read('pro-unlock.html').match(/<script>\s*\/\*[-\s]+Stripe[\s\S]*?<\/script>/)[0];
  const norm = src => src.replace(/\r/g, '').replace(/'[^'\n]*'/g, "''").replace(/\/\*[\s\S]*?\*\//, '').replace(/\d+/g, '0');
  assert.equal(norm(script), norm(ja.replace(/^<script>|<\/script>$/g, '')));
  const calls = [], nodes = new Map();
  const c = {
    URLSearchParams, location: { search: '?session_id=cs_test_en', href: '' },
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
    localStorage: { getItem: () => null, setItem() {} },
    fetch() { return new Promise(() => {}); }, setTimeout() {},
    trackEvent: (...a) => calls.push(a),
  };
  c.window = c; vm.createContext(c); vm.runInContext(script, c);
  c.showReady('MNPRO-TEST'); c.showReady('MNPRO-TEST');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].currency, 'USD');
  assert.equal(calls[0][1].value, 19);
  assert.match(script, /location\.href = '\.\.\/\?lang=en';/);
});
