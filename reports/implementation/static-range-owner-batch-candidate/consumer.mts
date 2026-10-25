/** @file Runs the new typed native entry point with real DOM implementations. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { JSDOM } from '@rustdom/rustdom';
import { initializeStaticRangeWithOwners, NativeRange } from '@rustdom/rustdom/native';
const source = process.env.RUSTDOM_STATIC_RANGE_SOURCE;
if (!source) throw new Error('Typed owner-pair consumer requires RUSTDOM_STATIC_RANGE_SOURCE');
const { implForWrapper } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/utils'));
const { domSymbolTree } = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants'));
const exceptionFactory = require(path.join(source, 'dist/vendor-jsdom/lib/jsdom/living/generated/DOMException'));
const dom = new JSDOM('<main>abcdef</main>');
try {
  const start = implForWrapper(dom.window.document.querySelector('main')!.firstChild);
  const state = initializeStaticRangeWithOwners(dom.window, start, 2, start, 4, {
    nodeIds(startNode: object, endNode: object): [number, number] {
      return [domSymbolTree._ensure(startNode), domSymbolTree._ensure(endNode)];
    },
    exception(globalObject: object, message: string, name: string): unknown {
      return exceptionFactory.create(globalObject, [message, name]);
    },
  });
  assert.ok(state instanceof NativeRange);
  assert.equal(state.startOffset, 2); assert.equal(state.endOffset, 4); assert.equal(state.collapsed, false);
} finally { dom.window.close(); }
