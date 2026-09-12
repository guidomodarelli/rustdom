/** @file Verifies an installed archive loads with an unbundled host label and real ICU behavior. */
'use strict';
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
/** Preserve the real ICU version separately from the forced selection label. */
const actualUnicodeVersion = process.versions.unicode;
Object.defineProperty(process.versions, 'unicode', { value: 'rustdom-unbundled-package-profile' });
const runtime = require('@rustdom/rustdom');
/** Resolve the independent upstream dependency from the installed package, including pnpm layouts. */
const packageRequire = createRequire(require.resolve('@rustdom/rustdom'));
const reference = packageRequire('jsdom');

/** @param {object} engine - Real engine exports. @returns {object} Observable attribute results. */
function inspect(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>');
  try {
    const element = dom.window.document.querySelector('main');
    const names = ['A', 'a', 'Ä', 'ä', 'ß', 'ﬀ', 'İ', '𐐀', '\ua7cb', '\ua7ce'];
    for (const name of names) element.setAttributeNS(null, name, 'value');
    return {
      keys: Reflect.ownKeys(element.attributes).filter((name) => typeof name === 'string'),
      own: names.map((name) => Object.hasOwn(element.attributes, name)),
      html: element.outerHTML,
    };
  } finally {
    dom.window.close();
  }
}

assert.deepEqual(inspect(runtime), inspect(reference));
assert.ok(runtime.getParserStatistics().nativeDocument > 0);
process.stdout.write(JSON.stringify({ actualUnicodeVersion, selectedVersion: process.versions.unicode, pass: true }) + '\n');
