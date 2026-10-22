/** @file Exercises representative retained string decisions through real public DOM contracts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const reference = require('jsdom');
assert.ok(process.env.RUSTDOM_PUBLIC_PACKAGE_ROOT, 'Set the real pinned RUSTDOM_PUBLIC_PACKAGE_ROOT');
const candidate = require(join(process.env.RUSTDOM_PUBLIC_PACKAGE_ROOT, 'dist/index.cjs'));

/** Keep results scalar and close the owning realm even when an assertion fails. */
function observe(runtime) {
  const dom = new runtime.JSDOM('<!doctype html><ol></ol><input><progress max="100"></progress><a></a>');
  try {
    const document = dom.window.document;
    const element = document.createElement('D\u0130V');
    const input = document.querySelector('input');
    input.type = 'TeXT'; input.value = 'a\n\rb';
    const text = { type: input.type, value: input.value };
    input.type = 'url'; input.value = ' \t\nhttps://inventory.invalid/path\r ';
    const url = input.value;
    input.type = 'color'; input.value = '#Ab12Cd';
    const color = input.value; input.value = '#xyzxyz'; const invalidColor = input.value;
    input.type = 'number'; input.value = '1.25e2';
    const number = input.valueAsNumber; input.value = '1.25junk'; const invalidNumber = input.value;
    input.type = 'text'; input.setAttribute('maxlength', ' \t12junk'); const maximumLength = input.maxLength;
    input.setAttribute('maxlength', '\u00a012'); const nonAsciiLength = input.maxLength;
    const list = document.querySelector('ol'); list.setAttribute('start', ' \t-12junk'); const start = list.start;
    const progress = document.querySelector('progress'); progress.setAttribute('value', '12.5junk');
    const anchor = document.querySelector('a'); anchor.setAttribute('rel', ' NEXT\tprev\nNEXT ');
    return { names: [element.localName, element.tagName], text, url, color, invalidColor, number, invalidNumber,
      maximumLength, nonAsciiLength, start, progress: progress.value, tokens: [...anchor.relList] };
  } finally { dom.window.close(); }
}

test('real HTML consumers preserve ASCII, non-ASCII, numeric prefix and token behavior', () => {
  const expected = observe(reference);
  assert.deepEqual(observe(candidate), expected);
  assert.deepEqual(expected, { names: ['d\u0130v', 'D\u0130V'], text: { type: 'text', value: 'ab' },
    url: 'https://inventory.invalid/path', color: '#ab12cd', invalidColor: '#000000', number: 125,
    invalidNumber: '', maximumLength: 12, nonAsciiLength: -1, start: -12, progress: 12.5,
    tokens: ['NEXT', 'prev'] });
});
