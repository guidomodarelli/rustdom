/** @file Exercises full clone benchmark behavior and owner restoration with independent real engines. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nodeCloneFixture } = require('../../benchmarks/node-clone.cjs');
const { NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD } = require('../../benchmarks/constants/node-clone.cjs');
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
for (const name of [...NODE_CLONE_WORKLOADS, NESTED_TEMPLATE_CLONE_WORKLOAD]) {
  test(`should clone every prepared node and preserve the original benchmark owner for ${name}`, () => {
    const outputs = {};
    for (const [engine, runtime] of Object.entries(engines)) {
      const { window } = new runtime.JSDOM('<p>preserved</p>');
      const original = window.document.body.firstChild, markup = window.document.body.innerHTML;
      try {
        outputs[engine] = [];
        for (const size of name === NESTED_TEMPLATE_CLONE_WORKLOAD ? [32, 256] : [100, 1000]) {
          const fixture = nodeCloneFixture(runtime, window, size, name);
          try { fixture.validate(fixture.run()); outputs[engine].push(fixture.serialize()); }
          finally { fixture.dispose(); }
          assert.equal(window.document.body.firstChild, original); assert.equal(window.document.body.innerHTML, markup);
        }
      } finally { window.close(); }
    }
    assert.deepEqual(outputs.rustdom, outputs.jsdom);
  });
}

for (const [engine, runtime] of Object.entries(engines)) {
  test(`should reject an imported template content whose owner is changed to its source for ${engine}`, () => {
    const { window } = new runtime.JSDOM('<!doctype html><body>');
    const fixture = nodeCloneFixture(runtime, window, 0, 'import-template-content');
    try {
      const result = fixture.run(), copy = fixture.result, source = fixture.source;
      assert.notEqual(copy.ownerDocument, source.ownerDocument);
      source.content.ownerDocument.adoptNode(copy.content);
      assert.equal(copy.content.ownerDocument, source.content.ownerDocument);
      assert.throws(() => fixture.validate(result), assert.AssertionError);
    } finally { fixture.dispose(); window.close(); }
  });

  test(`should reject a clone workload whose original source was adopted after cloning for ${engine}`, () => {
    const { window } = new runtime.JSDOM('<!doctype html><body>');
    const fixture = nodeCloneFixture(runtime, window, 4, 'import-deep-children');
    try {
      const result = fixture.run(), source = fixture.source;
      const foreign = window.document.implementation.createHTMLDocument('foreign');
      foreign.adoptNode(source); assert.equal(source.ownerDocument, foreign);
      assert.throws(() => fixture.validate(result), assert.AssertionError);
    } finally { fixture.dispose(); window.close(); }
  });
}
