/** @file Loads a real DOM runtime after replacing Symbol's constructor in an isolated process. */
'use strict';
const assert = require('node:assert/strict');
const [engine, scenario] = process.argv.slice(2);
const descriptor = Object.getOwnPropertyDescriptor(Symbol.prototype, 'constructor');
const iterator = Symbol.iterator;
const arrayIterator = Object.getOwnPropertyDescriptor(Array.prototype, iterator);
const decoy = Symbol('Symbol.iterator');
let constructorReads = 0;
let decoyReads = 0;
let dom;
try {
  if (scenario === 'throwing-getter') {
    Object.defineProperty(Symbol.prototype, 'constructor', {
      configurable: true,
      get() { constructorReads++; throw new Error('Symbol constructor getter must not run'); },
    });
  } else {
    Symbol.prototype.constructor = scenario === 'undefined' ? undefined :
      scenario === 'wrong-iterator' ? { iterator: decoy } : null;
  }
  if (scenario === 'decoy-first') {
    delete Array.prototype[iterator];
    Object.defineProperty(Array.prototype, decoy, {
      configurable: true,
      get() { decoyReads++; throw new Error('Decoy symbol getter must not run'); },
    });
    Object.defineProperty(Array.prototype, iterator, arrayIterator);
  }
  const runtime = require(engine === 'jsdom' ? 'jsdom' : '../../dist/index.cjs');
  dom = new runtime.JSDOM('<p>ready</p>');
  const text = dom.window.document.querySelector('p').textContent;
  const xml = new dom.window.XMLSerializer().serializeToString(dom.window.document.body);
  assert.equal(text, 'ready');
  assert.equal(xml, '<body xmlns="http://www.w3.org/1999/xhtml"><p>ready</p></body>');
  assert.equal(constructorReads, 0);
  assert.equal(decoyReads, 0);
  if (engine === 'rustdom') {
    const statistics = runtime.getNativeTreeStatistics().xmlSerialization;
    assert.ok(statistics.created > 0);
    assert.equal(statistics.live, 0);
    assert.equal(statistics.references, 0);
    assert.equal(statistics.cleanupErrors, 0);
  }
  process.stdout.write(`${JSON.stringify({ text, xml, constructorReads, decoyReads })}\n`);
} finally {
  dom?.window.close();
  Object.defineProperty(Symbol.prototype, 'constructor', descriptor);
  if (scenario === 'decoy-first') {
    delete Array.prototype[decoy];
    Object.defineProperty(Array.prototype, iterator, arrayIterator);
  }
}