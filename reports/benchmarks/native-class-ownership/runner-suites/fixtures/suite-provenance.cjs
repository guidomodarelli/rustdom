/** @file Proves that public runner DOM operations allocate in the declared native package. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const settings = require('./suite-provenance.constants.json');

/** Register a real Range construction/cloning contract in the current runner realm. */
module.exports = function registerProvenance(test, getDocument) {
  test('should construct and clone runner ranges in the declared native package', () => {
    const root = fs.realpathSync(process.env[settings.expectedRootEnvironment]);
    const nodeRequire = createRequire(__filename);
    const nativeFile = fs.realpathSync(nodeRequire.resolve('@rustdom/rustdom/native'));
    assert.equal(nativeFile, fs.realpathSync(path.join(root, 'dist/native.cjs')));
    const { NativeRange } = nodeRequire('@rustdom/rustdom/native');
    const document = getDocument();
    const element = document.createElement('section'); element.textContent = 'native-owner';
    const before = NativeRange.statistics().created;
    const range = document.createRange(); range.selectNodeContents(element);
    const clone = range.cloneRange();
    const created = NativeRange.statistics().created - before;
    assert.equal(created, 2);
    clone.setStart(element.firstChild, 1);
    assert.equal(range.toString(), 'native-owner'); assert.equal(clone.toString(), 'ative-owner');
    assert.equal(range.startContainer, element); assert.equal(clone.startContainer, element.firstChild);
    process.stdout.write(`${settings.probePrefix}${JSON.stringify({ root, nativeFile, node: process.version, created })}\n`);
  });
};
