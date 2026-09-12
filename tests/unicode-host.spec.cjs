/** @file Verifies unknown host profile initialization and atomic native case-data transfers. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { NativeTree } = require('../dist/native.cjs');
/** Cold dependency loading exceeded two minutes on /mnt/c under concurrent I/O; bound the whole worker. */
const WORKER_TIMEOUT_MS = 300_000;

for (const [mode, selectedVersion] of [['--unknown', 'rustdom-unbundled-test-profile'], ['--missing', null]]) {
  test(`should load and preserve real host Unicode behavior when the version is ${mode.slice(2)}`, (testContext) => {
    const child = spawnSync(process.execPath, ['--expose-gc', resolve(__dirname, 'helpers/unicode-host-worker.cjs'), mode], {
      encoding: 'utf8', timeout: WORKER_TIMEOUT_MS,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(child.stdout);
    assert.equal(report.actualUnicodeVersion, process.versions.unicode);
    assert.equal(report.selectedVersion, selectedVersion);
    assert.equal(report.windowsAndDocumentsObserved, 48);
    assert.equal(report.survivors, 0);
    testContext.diagnostic(JSON.stringify(report));
  });
}

test('should copy host scalar payloads and preserve the active profile after invalid transfers', () => {
  const tree = new NativeTree();
  const element = tree.allocate();
  tree.setHtmlElement(element, 'div', []);
  tree.initializeAttributeCollection(element);
  for (const name of ['A', 'a', 'ß']) {
    const attribute = tree.allocate();
    tree.initializePlainAttribute(attribute, name, 'case');
    tree.appendAttribute(element, attribute);
  }
  const changes = new Uint32Array([65]);
  tree.setHostUnicodeCaseChanges(changes.buffer);
  changes[0] = 97;
  assert.deepEqual(tree.attributeNames(element, true, true), ['a', 'ß']);
  structuredClone(changes.buffer, { transfer: [changes.buffer] });
  assert.deepEqual(tree.attributeNames(element, true, true), ['a', 'ß']);
  const detached = new Uint32Array([65]).buffer;
  structuredClone(detached, { transfer: [detached] });
  for (const [reason, invalid] of [
    ['surrogate', new Uint32Array([0xd800]).buffer], ['outside Unicode', new Uint32Array([0x110000]).buffer],
    ['duplicate', new Uint32Array([65, 65]).buffer], ['unsorted', new Uint32Array([66, 65]).buffer],
    ['partial scalar', new ArrayBuffer(1)], ['detached', detached],
    ['shared', new SharedArrayBuffer(4)], ['view', new Uint32Array([65])], ['array', []], ['null', null],
  ]) {
    assert.throws(() => tree.setHostUnicodeCaseChanges(invalid), { code: 'InvalidArg' }, reason);
    assert.deepEqual(tree.attributeNames(element, true, true), ['a', 'ß']);
  }
  assert.equal(tree.trySetUnicodeVersion('unbundled-test-profile'), false);
  assert.deepEqual(tree.attributeNames(element, true, true), ['a', 'ß']);
  assert.equal(tree.trySetUnicodeVersion('15.1'), true);
  assert.deepEqual(tree.attributeNames(element, true, true), ['a', 'ß']);
});
