/** @file Copies a pinned private jsdom runtime and replaces only its HTML parsing dependency. */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/** Resolve dependencies from this project without modifying Node's module cache. */
const require = createRequire(import.meta.url);
/** Preserve upstream paths for stylesheets and synchronous XHR workers. */
const upstreamRoot = dirname(require.resolve('jsdom/package.json'));
/** Keep the private runtime adjacent to the native loader. */
const destination = resolve('dist/vendor-jsdom');

/**
 * Apply an exact, singular build-time substitution to a pinned source.
 * @param {string} source - Source file contents.
 * @param {string} original - Expected upstream dependency statement.
 * @param {string} replacement - Project-local dependency statement.
 * @returns {string} Source with exactly one dependency changed.
 * @throws {Error} When an upstream upgrade invalidates the injection boundary.
 */
function substituteOnce(source, original, replacement) {
  if (source.split(original).length !== 2) {
    throw new Error(`rustdom build: expected exactly one parser dependency boundary: ${original}`);
  }
  return source.replace(original, replacement);
}

await mkdir(destination, { recursive: true });
await cp(resolve(upstreamRoot, 'lib'), resolve(destination, 'lib'), { recursive: true });
await cp(resolve(upstreamRoot, 'package.json'), resolve(destination, 'package.json'));
await cp(resolve(upstreamRoot, 'LICENSE.txt'), resolve(destination, 'LICENSE.txt'));

/** Patch the private copy; node_modules/jsdom remains the independent reference. */
const parserPath = resolve(destination, 'lib/jsdom/browser/parser/html.js');
await writeFile(parserPath, substituteOnce(await readFile(parserPath, 'utf8'),
  'const parse5 = require("parse5");',
  'const parse5 = require("../../../../../parser-bridge.cjs");'));

/** Replace only DOM topology; other uses of symbol-tree remain upstream implementations. */
const constantsPath = resolve(destination, 'lib/jsdom/living/helpers/internal-constants.js');
await writeFile(constantsPath, substituteOnce(await readFile(constantsPath, 'utf8'),
  'const SymbolTree = require("symbol-tree");',
  'const SymbolTree = require("../../../../../native-tree.cjs");'));
const nativeTree = await readFile('src/dom/native-tree.cjs', 'utf8');
await writeFile('dist/native-tree.cjs', substituteOnce(nativeTree,
  "require('../../dist/native.cjs')", "require('./native.cjs')"));

/** Relocate authored modules without bundling or runtime module-cache mutations. */
let bridge = await readFile('src/parser/bridge.cjs', 'utf8');
bridge = substituteOnce(bridge, "require('../../dist/native.cjs')", "require('./native.cjs')");
bridge = substituteOnce(bridge, "require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js')",
  "require('./vendor-jsdom/lib/jsdom/living/generated/utils.js')");
await writeFile('dist/parser-bridge.cjs', bridge);
let entry = await readFile('src/index.cjs', 'utf8');
entry = substituteOnce(entry, "require('jsdom')", "require('./vendor-jsdom/lib/api.js')");
entry = substituteOnce(entry, "require('./parser/bridge.cjs')", "require('./parser-bridge.cjs')");
entry = substituteOnce(entry, "require('../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js')",
  "require('./vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js')");
await writeFile('dist/index.cjs', entry);
