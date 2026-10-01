const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const selectors = [html.match(/^const \$\s+=.*$/m)[0], html.match(/^const \$\$\s+=.*$/m)[0]].join('\n');
const binding = html.match(/^(\$\$?\('\[data-share\]'\)\.forEach[\s\S]*?)^\/\/ deep links:/m)[1];

function run(writeText = async () => {}) {
  const buttons = ['x', 'line', 'copy'].map(share => ({ dataset: { share } }));
  const messages = [], prompts = [], opened = [];
  const c = {
    document: {
      querySelector() { return buttons[0]; },
      querySelectorAll() { return buttons; },
    },
    navigator: { clipboard: { writeText } },
    SHARE_URL: 'https://menufits.kokokikaku.com/', SHARE_TXT: 'Public product description',
    toast: message => messages.push(message),
    prompt: (...args) => prompts.push(args),
    window: { open: (...args) => opened.push(args) },
    encodeURIComponent,
  };
  vm.runInNewContext(selectors + '\n' + binding, c);
  return { buttons, messages, prompts, opened };
}

test('all three share controls bind without interrupting editor startup', async () => {
  const { buttons, opened } = run();
  for (const button of buttons) assert.equal(typeof button.onclick, 'function');
  await buttons[0].onclick();
  await buttons[1].onclick();
  assert.equal(opened.length, 2);
  assert.match(opened[0][0], /^https:\/\/twitter\.com\/intent\/tweet\?/);
  assert.match(opened[1][0], /^https:\/\/social-plugins\.line\.me\/lineit\/share\?/);
});

test('copy confirms success only after the clipboard write succeeds', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { buttons, messages, prompts } = run(() => pending);
  const clicked = buttons[2].onclick();
  assert.equal(messages.length, 0);
  release();
  await clicked;
  assert.deepEqual(messages, ['リンクをコピーしました']);
  assert.equal(prompts.length, 0);
});

test('copy failure offers the public URL without claiming success', async () => {
  const { buttons, messages, prompts } = run(async () => { throw Error('clipboard denied'); });
  await buttons[2].onclick();
  assert.equal(messages.length, 0);
  assert.deepEqual(prompts, [['このURLをコピーしてください', 'https://menufits.kokokikaku.com/']]);
});
