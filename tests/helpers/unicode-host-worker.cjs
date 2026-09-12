/** @file Exercises the real DOM with an unbundled version label and unchanged host ICU tables. */
'use strict';
const assert = require('node:assert/strict');
/** Report the real host separately from the deliberately unknown selector identifier. */
const actualUnicodeVersion = process.versions.unicode;
if (process.argv.includes('--unknown')) {
  Object.defineProperty(process.versions, 'unicode', { value: 'rustdom-unbundled-test-profile' });
} else if (process.argv.includes('--missing')) {
  Object.defineProperty(process.versions, 'unicode', { value: undefined });
}
/** Loading rustdom must succeed even when the host version label is not bundled. */
const runtime = require('../../dist/index.cjs');
const reference = require('jsdom');
/** Observe windows and documents without retaining either kind of object. */
const references = [];

/**
 * Exercise public attribute enumeration, lookup and serialization against an engine.
 * @param {object} engine - Real rustdom or independent jsdom exports.
 * @returns {object} Primitive observable results, without retained DOM objects.
 */
function inspect(engine) {
  const dom = new engine.JSDOM('<!doctype html><main></main>');
  try {
    const element = dom.window.document.querySelector('main');
    const names = ['a', 'A', 'Ä', 'ä', 'ß', 'ﬀ', 'İ', 'Σ', 'σ', '𐐀', '𐐨', '\ua7cb', '\ua7ce'];
    for (const name of names) element.setAttributeNS(null, name, 'case');
    return {
      names: Reflect.ownKeys(element.attributes).filter((name) => typeof name === 'string'),
      own: names.map((name) => Object.hasOwn(element.attributes, name)),
      values: names.map((name) => element.getAttributeNS(null, name)),
      html: element.outerHTML,
    };
  } finally {
    references.push(new WeakRef(dom.window), new WeakRef(dom.window.document));
    dom.window.close();
  }
}

/** @returns {Promise<void>} Wait for finalizers and major GC across separate turns. */
async function settle() {
  for (let cycle = 0; cycle < 8; cycle++) {
    await new Promise((resolve) => setImmediate(resolve));
    await global.gc({ type: 'major', execution: 'async' });
  }
}

/** @returns {Promise<void>} Check behavior and collection without substituting future Unicode data. */
async function main() {
  for (let cycle = 0; cycle < 12; cycle++) assert.deepEqual(inspect(runtime), inspect(reference));
  await settle();
  assert.equal(references.filter((reference) => reference.deref() !== undefined).length, 0);
  const statistics = runtime.getNativeTreeStatistics();
  assert.equal(statistics.liveNodes, 0);
  assert.equal(statistics.dataNodes, 0);
  process.stdout.write(JSON.stringify({
    actualUnicodeVersion, selectedVersion: process.versions.unicode ?? null,
    windowsAndDocumentsObserved: references.length, survivors: 0,
    liveNodes: statistics.liveNodes, dataNodes: statistics.dataNodes,
  }) + '\n');
}

main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
