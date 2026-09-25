// index.html の CSP（2026-09-25 追加）。読み込み先を足したのに CSP を直し忘れると、
// 本番で黙って壊れる（書体が代替になる・ライセンス解放が通らない・計測が止まる）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
const csp = meta ? Object.fromEntries(meta[1].split(';').map(s => s.trim()).filter(Boolean)
  .map(d => { const [k, ...v] = d.split(/\s+/); return [k, v]; })) : null;

test('index.html has a CSP, placed before any script or stylesheet', () => {
  assert.ok(csp, 'CSP meta is missing');
  const at = html.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(at < html.indexOf('<script'), 'CSP must come before the first script');
  assert.ok(at < html.indexOf('rel="stylesheet"'), 'CSP must come before the stylesheet');
});

test('CSP allows exactly what the app needs', () => {
  // ライセンス検証の関数（コードの VERIFY_URL から取る）
  const base = html.match(/const FUNCTIONS_BASE\s*=\s*'([^']+)'/);
  assert.ok(base, 'FUNCTIONS_BASE not found');
  assert.ok(csp['connect-src'].includes(new URL(base[1]).origin), 'connect-src must include the license API');
  // 書体
  assert.ok(csp['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(csp['font-src'].includes('https://fonts.gstatic.com'));
  // 解析
  assert.ok(csp['script-src'].includes('https://www.googletagmanager.com'));
  assert.ok(csp['connect-src'].some(s => s.includes('google-analytics.com')));
  // 写真（FileReader → data:）
  assert.ok(csp['img-src'].includes('data:'));
  // 締めるところ
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'self'"]);
  assert.deepEqual(csp['form-action'], ["'none'"]);
  assert.deepEqual(csp['default-src'], ["'self'"]);
});

test('every external script, stylesheet and fetch target in index.html is allowed by the CSP', () => {
  const allowed = dir => (csp[dir] || csp['default-src']);
  const covers = (list, origin) => list.some(s => s === origin
    || (s.startsWith('https://*.') && origin.endsWith(s.slice('https://*'.length))));
  const origins = (re) => [...html.matchAll(re)].map(m => new URL(m[1]).origin);
  for (const o of origins(/<script[^>]+src="(https:[^"]+)"/g)) assert.ok(covers(allowed('script-src'), o), 'script ' + o);
  for (const o of origins(/<link[^>]+href="(https:[^"]+)"[^>]*rel="stylesheet"/g)) assert.ok(covers(allowed('style-src'), o), 'style ' + o);
  for (const o of origins(/const \w+\s*=\s*'(https:\/\/[^']*cloudfunctions[^']*)'/g)) assert.ok(covers(allowed('connect-src'), o), 'fetch ' + o);
  assert.ok(origins(/const \w+\s*=\s*'(https:\/\/[^']*cloudfunctions[^']*)'/g).length > 0, 'the functions base URL must be found');
});
