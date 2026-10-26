/** Exercise both native APIs together through the actual package export after strict compilation. */
import assert = require('node:assert/strict');
import { NativeRange, NativeTree } from '@rustdom/rustdom/native';

const tree = new NativeTree();
const text = tree.allocate();
try {
  tree.setCharacterData(text, 3, 'abcdef');
  const original: NativeRange = NativeRange.fromEndpoints(text, 1, text, 4);
  const copy: NativeRange = original.copy();
  const updateStart: boolean = copy.collapse(false);
  assert.equal(updateStart, true);
  assert.equal(copy.startOffset, 4);
  assert.equal(copy.endOffset, 4);
  assert.equal(tree.rangeTextFromState(copy), '');
  assert.equal(tree.rangeTextFromState(original), 'bcd');
} finally { tree.release(text); }
