/** Exercise the declared native endpoint API through the real package export after compilation. */
import assert = require('node:assert/strict');
import { NativeRange, NativeTree } from '@rustdom/rustdom/native';

const tree = new NativeTree();
const text = tree.allocate();
try {
  tree.setCharacterData(text, 3, 'abcdef');
  const range: NativeRange = NativeRange.fromEndpoints(text, 1, text, 4);
  assert.equal(range.start?.node, text);
  assert.equal(range.end?.node, text);
  assert.equal(tree.rangeTextFromState(range), 'bcd');
  const copy: NativeRange = range.copy();
  copy.setStart(text, 2);
  assert.equal(tree.rangeTextFromState(copy), 'cd');
  assert.equal(tree.rangeTextFromState(range), 'bcd');
} finally {
  tree.release(text);
}
