/** @file Installed CJS/ESM native consumers use the same real immutable copy implementation. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('should initialize independent copies through installed native CJS and ESM exports', async () => {
  const native = require('@rustdom/rustdom/native');
  const module = await import('@rustdom/rustdom/native');
  assert.equal(module.NativeAttributeCopy, native.NativeAttributeCopy);
  assert.equal(module.attributeCopyStatistics, native.attributeCopyStatistics);
  const source = new native.NativeTree(), target = new module.NativeTree();
  const attribute = source.allocate();
  source.initializeAttribute(attribute, '{"kind":2,"name":"id","value":[65,0,55296]}');
  const copy = native.NativeAttributeCopy.prepare(source, attribute); source.release(attribute);
  const id = target.allocate(); copy.initialize(target, id);
  assert.equal(copy.value, 'A\0\ud800');
  assert.equal(target.attributeField(id, native.AttributeField.Value), copy.value);
  assert.equal(target.attributeOwner(id), 0);
  target.setAttributeValue(id, 'changed'); assert.equal(copy.value, 'A\0\ud800');
});
