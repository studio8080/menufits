const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../menu-washoku.html'), 'utf8');

test('和食記事は無料編集を主導線に保ち、その後に計測可能なPro比較導線を置く', () => {
  const cta = html.match(/<section class="cta">([\s\S]*?)<\/section>/)?.[1] || '';
  const free = '<a class="btn big" href="./#washoku" data-revenue="editor" data-revenue-placement="article">';
  const pro = '<a href="pro.html" data-revenue="pro" data-revenue-placement="article">';
  const freeAt = cta.indexOf(free);
  const proAt = cta.indexOf(pro);

  assert.notEqual(freeAt, -1);
  assert.notEqual(proAt, -1);
  assert.ok(freeAt < proAt, '無料編集CTAをPro比較リンクより先に置く');
  assert.match(cta, /追加の6デザイン、3ページ以上の冊子、複数メニューの作り分け/);
  assert.doesNotMatch(cta.slice(proAt, cta.indexOf('</a>', proAt)), /data-revenue="affiliate"/);
});
