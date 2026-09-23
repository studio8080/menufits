const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const html = read('index.html');

for (const privacy of ['enabled', 'optout', 'dnt']) test('editing and printing preserve privacy: ' + privacy, () => {
  const nodes = new Map(), handlers = {}, timers = [];
  let prints = 0, saved = 0;
  const stage = {addEventListener: (name, fn) => { handlers[name] = fn; }};
  const c = {navigator: {doNotTrack: privacy === 'dnt' ? '1' : '0'},
    localStorage: {getItem: () => privacy === 'optout' ? '1' : null},
    document: {createElement: () => ({}), head: {appendChild() {}}},
    $: id => id === '#stage' ? stage : (nodes.has(id) ? nodes.get(id) : (nodes.set(id, {}), nodes.get(id))),
    $$: () => [], sanitizeHTML: v => v, set() {}, save() {saved++;},
    clearTimeout() {}, setTimeout(fn) {timers.push(fn);}, checkOverflow() {},
    mask: {classList: {remove() {}}}, openModal() {}, print() {prints++;}
  };
  c.window = c; vm.createContext(c);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], c);
  vm.runInContext(html.slice(html.indexOf("const stage=$('#stage');"), html.indexOf("stage.addEventListener('keydown'")), c);
  vm.runInContext(html.slice(html.indexOf("$('#printBtn').onclick="), html.indexOf("$('#helpBtn').onclick=")), c);
  const field = {innerHTML: 'private shop name', dataset: {path: 'shop.name'}, closest: () => null};
  handlers.input({target: {closest: () => null}});
  handlers.input({target: {closest: () => field}});
  handlers.input({target: {closest: () => field}});
  nodes.get('#printBtn').onclick();
  nodes.get('#doPrint').onclick();
  timers.forEach(fn => fn());
  assert.equal(saved, 2); assert.equal(prints, 1);
  const events = (c.dataLayer || []).filter(a => a[0] === 'event');
  assert.deepEqual(Array.from(events, a => a[1]), privacy === 'enabled' ? ['menu_edit_start','menu_print_request'] : []);
  assert.ok(!JSON.stringify(events).includes('private shop name'));
});

function ads({privacy, pro, brokenTracker} = {}) {
  const events = [], listeners = {};
  const slot = {appendChild() {}, contains: () => true, addEventListener: (name, fn) => {listeners[name] = fn;}};
  const template = {innerHTML: '<a>ad</a>', content: {cloneNode() {return {};}}};
  const box = {querySelector: () => template, removeChild() {}, appendChild() {}, parentNode: {removeChild() {}}};
  const c = {URL, navigator: {doNotTrack: privacy === 'dnt' ? '1' : '0'},
    localStorage: {getItem: key => key === 'menufitsWebLicense' ? (pro ? 'license' : null) : (privacy === 'optout' ? '1' : null)},
    document: {querySelectorAll: s => s === '[data-ad]' ? [box] : [], createElement: () => slot},
    location: {href: 'https://menufits.kokokikaku.com/guide.html'},
    trackEvent: (...args) => {if (brokenTracker) throw Error('blocked'); events.push(args);}
  };
  c.window = c; vm.runInNewContext(read('ads.js'), c);
  return {events, click(href) {listeners.click?.call(slot, {target: {closest: () => ({href})}});}, listeners};
}
test('affiliate clicks classify providers without transmitting link parameters', () => {
  const p = ads();
  p.click('https://af.moshimo.com/af/c/click?a_id=private');
  p.click('https://px.a8.net/svt/ejp?a8mat=private');
  p.click('https://a8.net.example.org/');
  assert.deepEqual(p.events.map(e => [e[0], e[1].provider]), [['affiliate_click','moshimo'],['affiliate_click','a8']]);
  assert.ok(!JSON.stringify(p.events).includes('private'));
});
for (const options of [{pro: true},{privacy:'optout'},{privacy:'dnt'}]) test('excluded visitor has no affiliate handler ' + JSON.stringify(options), () => {
  assert.equal(ads(options).listeners.click, undefined);
});
test('tracking failure does not throw from the affiliate click handler', () => {
  assert.doesNotThrow(() => ads({brokenTracker:true}).click('https://af.moshimo.com/af/c/click'));
});
