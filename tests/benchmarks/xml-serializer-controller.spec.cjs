/** @file Exercises actual public XML workloads, exact outputs/errors and controller routing in both engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serializationFixture } = require('../../benchmarks/xml-serialization.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const name of ['xml-serialize', 'xml-inner-serialize', 'xml-document-serialize', 'xml-serialize-error', 'xml-serializer-getter-error']) {
  test(`should preserve correct public output and controller lifetime for ${name}`, () => {
    const outputs = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const work = serializationFixture(runtime, 3, name);
      try {
        work.prepare(); const result = work.run(); work.validate(result); outputs[engine] = work.serialize();
        work.prepare();
        for (let operation = 0; operation < 7; operation++) assert.equal(work.run(), result);
        work.validate(result, 7); assert.equal(work.serialize(), outputs[engine]);
      }
      finally { work.dispose(); }
    }
    assert.equal(outputs.rustdom, outputs.jsdom);
  });
}
