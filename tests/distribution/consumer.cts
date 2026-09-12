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
dom.window.close();

const tree = new native.NativeTree();
const handle = tree.allocate();
tree.setHtmlElement(handle, 'b', ['title', 'installed']);
assert.equal(tree.serializeHtml(handle, true, false), '<b title="installed"></b>');
tree.release(handle);
assert.equal(tree.statistics().liveNodes, 0);
