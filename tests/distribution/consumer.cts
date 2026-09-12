/** Exercises the installed CommonJS contract with TypeScript and the real native addon. */
import assert = require('node:assert/strict');
import rustdom = require('@rustdom/rustdom');
import native = require('@rustdom/rustdom/native');
import JestEnvironment = require('@rustdom/rustdom/jest');

const dom = new rustdom.JSDOM('<!doctype html><p id="target">Before</p>');
const paragraph: Element | null = dom.window.document.querySelector('#target');
assert.ok(paragraph);
assert.equal(dom.window.getComputedStyle(paragraph).display, 'block');
paragraph.textContent = 'After 🦀';
assert.ok(dom.serialize().includes('After 🦀'));
assert.ok(rustdom.getParserStatistics().nativeDocument > 0);
assert.ok(rustdom.getNativeTreeStatistics().nativeQueries > 0);
for (const name of ['Ä', 'ä', '\ua7ce', '\ua7d2', '\ua7d4']) {
  paragraph.setAttributeNS(null, name, 'case');
  // Pinned jsdom exposes named lookup separately from own-key enumeration.
  assert.equal(Object.hasOwn(paragraph.attributes, name), true);
  assert.equal(Reflect.ownKeys(paragraph.attributes).includes(name), name.toLowerCase() === name);
}
assert.equal(typeof JestEnvironment.prototype.getVmContext, 'function');
assert.ok(paragraph.isEqualNode(paragraph.cloneNode(true)));
assert.ok(dom.window.document.body.contains(paragraph));
const instruction = dom.window.document.createProcessingInstruction('target', 'before');
instruction.data = 'after';
assert.equal(instruction.target, 'target');
assert.ok(instruction.isEqualNode(dom.window.document.createProcessingInstruction('target', 'after')));
dom.window.close();

const tree = new native.NativeTree();
const handle = tree.allocate();
tree.setHtmlElement(handle, 'b', ['title', 'installed']);
assert.equal(tree.serializeHtml(handle, true, false), '<b title="installed"></b>');
const doctypeHandle = tree.allocate();
tree.initializeDocumentType(doctypeHandle, 'html', '\ud800', 'system');
assert.equal(tree.documentTypeField(doctypeHandle, native.DocumentTypeField.PublicId), '\ud800');
assert.equal(tree.compareDocumentPosition(handle, doctypeHandle), 37);
assert.equal(tree.equalNode(handle, doctypeHandle), false);
tree.release(doctypeHandle);
tree.release(handle);
assert.equal(tree.statistics().liveNodes, 0);
