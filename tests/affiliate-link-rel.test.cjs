const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = [
  'guide.html',
  'faq.html',
  'templates.html',
  'menu-cafe.html',
  'menu-izakaya.html',
  'menu-chuka.html',
  'menu-washoku.html',
];

test('もしもアフィリエイトリンクはnofollowとsponsoredを併記する', () => {
  const anchors = pages.flatMap((page) => {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    return [...html.matchAll(/<a\b(?=[^>]*href="https:\/\/af\.moshimo\.com\/af\/c\/click)[^>]*>/g)]
      .map((match) => ({ page, tag: match[0] }));
  });

  assert.equal(anchors.length, 9, '現在の承認済みアフィリエイトリンク9件を検査する');
  for (const { page, tag } of anchors) {
    const rel = tag.match(/\brel="([^"]*)"/)?.[1].split(/\s+/) || [];
    assert.ok(rel.includes('nofollow'), `${page}: nofollowを保持する`);
    assert.ok(rel.includes('sponsored'), `${page}: sponsoredを付与する`);
    assert.match(tag, /\breferrerpolicy="no-referrer-when-downgrade"/,
      `${page}: 既存のreferrerpolicyを保持する`);
    assert.match(tag, /\battributionsrc\b/, `${page}: 既存のattributionsrcを保持する`);
  }
});
