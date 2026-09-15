/** @file Native token plans operate on canonical attributes and preserve independent shared sets. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NativeTree, NativeTokenList, TokenListMethod, TokenValidation } = require('../dist/native.cjs');

/** @param {string} value - Initial attribute. @returns {object} Real canonical native owner and token list. */
function fixture(value = ' a b a ') {
  const tree = new NativeTree(); const owner = tree.allocate(); const attribute = tree.allocate();
  tree.setData(owner, JSON.stringify({ kind: 1, name: 'div' })); tree.initializeAttributeCollection(owner);
  tree.initializeAttribute(attribute, JSON.stringify({ kind: 2, name: 'class', value })); tree.appendAttribute(owner, attribute);
  const list = tree.createTokenList(owner, 'class'); return { tree, owner, attribute, list };
}

test('should read canonical attributes and require invalidation before replacing a parsed set', () => {
  const { tree, attribute, list } = fixture();
  assert.equal(tree.tokenListLength(list), 2); const previous = tree.tokenListSet(list);
  tree.setAttributeValue(attribute, 'new final'); assert.equal(tree.tokenListValue(list), 'new final');
  assert.equal(tree.tokenListContains(list, 'a'), true);
  list.invalidate(); assert.equal(tree.tokenListContains(list, 'new'), true);
  assert.equal(previous.get(0), 'a'); assert.equal(previous.size, 2);
  assert.equal(tree.tokenListItem(list, 0), 'new'); assert.equal(tree.tokenListItem(list, 2), null);
});

test('should preserve error precedence without mutating tokens or attributes', () => {
  const { tree, list } = fixture();
  assert.equal(tree.tokenListMutate(list, TokenListMethod.Add, ['bad space', '']).status, TokenValidation.Space);
  assert.equal(tree.tokenListMutate(list, TokenListMethod.Replace, ['bad space', '']).status, TokenValidation.Empty);
  assert.equal(tree.tokenListValue(list), ' a b a '); assert.equal(tree.tokenListLength(list), 2);
  assert.throws(() => tree.tokenListMutate(list, TokenListMethod.Replace, ['a']), /requires two tokens/);
});

test('should produce normalized writes and preserve forced-toggle noops', () => {
  const { tree, list } = fixture();
  assert.deepEqual(tree.tokenListMutate(list, TokenListMethod.Add, ['c', 'a']), { status: TokenValidation.Valid, result: false, value: 'a b c' });
  assert.equal(tree.tokenListValue(list), ' a b a ');
  const forced = tree.tokenListMutate(list, TokenListMethod.Toggle, ['a'], true);
  assert.equal(forced.result, true); assert.equal(forced.value, undefined);
  const replacement = tree.tokenListMutate(list, TokenListMethod.Replace, ['c', 'a']);
  assert.equal(replacement.value, 'a b'); assert.equal(replacement.result, true);
});

test('should reject foreign forests and keep supported tokens independent of parsing', () => {
  const { tree, owner, list } = fixture(); const other = fixture();
  assert.throws(() => other.tree.tokenListLength(list), /different forest/);
  assert.throws(() => other.tree.tokenListMutate(list, TokenListMethod.Add, ['x']), /different forest/);
  assert.equal(tree.tokenListValue(list), ' a b a ');
  const supported = tree.createTokenList(owner, 'class', ['stylesheet', 'UPPER']);
  assert.equal(supported.supports('STYLESHEET'), true); assert.equal(supported.supports('UPPER'), false);
  assert.equal(supported.supports(''), false); assert.equal(list.supports(''), null);
});

test('should release sparse capacity after removing many tokens while the list remains live', () => {
  const { tree, list } = fixture(''); const tokens = Array.from({ length: 4096 }, (_, index) => `token${index}`);
  tree.tokenListMutate(list, TokenListMethod.Add, tokens);
  const set = tree.tokenListSet(list); assert.equal(set.size, tokens.length);
  tree.tokenListMutate(list, TokenListMethod.Remove, tokens);
  assert.deepEqual(set.storage(), { length: 0, itemCapacity: 0, memberCapacity: 0 });
  assert.ok(NativeTokenList.statistics().created > 0);
});

test('should reject an owner whose raw native metadata no longer describes an element', () => {
  const tree = new NativeTree(); const owner = tree.allocate();
  tree.setData(owner, JSON.stringify({ kind: 1, name: 'div' })); const list = tree.createTokenList(owner, 'class');
  assert.equal(tree.tokenListLength(list), 0);
  tree.setData(owner, JSON.stringify({ kind: 3, value: 'text' }));
  assert.throws(() => tree.tokenListLength(list), /Element/);
  assert.throws(() => tree.tokenListMutate(list, TokenListMethod.Add, ['token']), /Element/);
});
