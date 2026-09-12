/** @file Builds the pinned private jsdom runtime and integrates native DOM operations. */
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, sep } from 'node:path';

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
let parserSource = substituteOnce(await readFile(parserPath, 'utf8'),
  'const parse5 = require("parse5");',
  'const parse5 = require("../../../../../parser-bridge.cjs");\nconst { domSymbolTree } = require("../../living/helpers/internal-constants");');
parserSource = substituteOnce(parserSource, '    templateElement._templateContents = contentFragment;',
  '    templateElement._templateContents = contentFragment;\n    domSymbolTree.updateNodeData(templateElement);');
await writeFile(parserPath, parserSource);

/** Replace only DOM topology; other uses of symbol-tree remain upstream implementations. */
const constantsPath = resolve(destination, 'lib/jsdom/living/helpers/internal-constants.js');
await writeFile(constantsPath, substituteOnce(await readFile(constantsPath, 'utf8'),
  'const SymbolTree = require("symbol-tree");',
  'const SymbolTree = require("../../../../../native-tree.cjs");'));
const nativeTree = await readFile('src/dom/native-tree.cjs', 'utf8');
await writeFile('dist/native-tree.cjs', substituteOnce(nativeTree,
  "require('../../dist/native.cjs')", "require('./native.cjs')"));
await cp('src/dom/data-bridge.cjs', 'dist/data-bridge.cjs');
await cp('src/dom/host-unicode.cjs', 'dist/host-unicode.cjs');

/** Keep Attr metadata canonical in Rust while existing DOM hooks retain ownership edges. */
const attributePath = resolve(destination, 'lib/jsdom/living/attributes/Attr-impl.js');
let attributeSource = substituteOnce(await readFile(attributePath, 'utf8'),
  'const { ATTRIBUTE_NODE } = require("../node-type.js");',
  'const { ATTRIBUTE_NODE } = require("../node-type.js");\nconst { domSymbolTree } = require("../helpers/internal-constants");');
attributeSource = substituteOnce(attributeSource,
  '    this._namespace = privateData.namespace !== undefined ? privateData.namespace : null;\n' +
  '    this._namespacePrefix = privateData.namespacePrefix !== undefined ? privateData.namespacePrefix : null;\n' +
  '    this._localName = privateData.localName;\n' +
  '    this._value = privateData.value !== undefined ? privateData.value : "";',
  '    domSymbolTree.initializeAttribute(this, ATTRIBUTE_NODE, privateData);');
attributeSource = substituteOnce(attributeSource,
  '    this._element = privateData.element !== undefined ? privateData.element : null;',
  '    domSymbolTree.initializeAttributeOwner(this, privateData.element !== undefined ? privateData.element : null);');
attributeSource = substituteOnce(attributeSource, '  get namespaceURI() {',
  '  get _element() { return domSymbolTree.attributeOwner(this); }\n' +
  '  get _namespace() { return domSymbolTree.attributeNamespace(this); }\n' +
  '  get _namespacePrefix() { return domSymbolTree.attributePrefix(this); }\n' +
  '  get _localName() { return domSymbolTree.attributeName(this); }\n' +
  '  get _value() { return domSymbolTree.attributeValue(this); }\n' +
  '  set _value(value) { domSymbolTree.setAttributeValue(this, value); }\n\n' +
  '  get namespaceURI() {');
attributeSource = substituteOnce(attributeSource,
  '    if (this._namespacePrefix === null) {\n      return this._localName;\n    }\n\n    return this._namespacePrefix + ":" + this._localName;',
  '    return domSymbolTree.attributeQualifiedName(this);');
await writeFile(attributePath, attributeSource);
await cp('src/dom/attribute-bridge.cjs', resolve(destination, 'lib/jsdom/living/attributes.js'));

/** Keep attributes and character data synchronized before DOM observers run. */
const elementPath = resolve(destination, 'lib/jsdom/living/nodes/Element-impl.js');
let elementSource = substituteOnce(await readFile(elementPath, 'utf8'),
  '    this._attributeList = [];\n    // Used for caching.\n    this._attributesByNameMap = new Map();',
  '    domSymbolTree.initializeAttributeCollection(this);');
elementSource = substituteOnce(elementSource, '  _attach() {',
  '  get _attributeList() { return domSymbolTree.attributeList(this); }\n\n  _attach() {');
elementSource = substituteOnce(elementSource, '    return domSelector.matches(selectors, this);',
  '    const nodes = domSymbolTree.matchNode(selectors, this);\n    return nodes === null ? domSelector.matches(selectors, this) : nodes.length > 0;');
elementSource = substituteOnce(elementSource, '    return domSelector.closest(selectors, this);',
  '    const nodes = domSymbolTree.closestNode(selectors, this);\n    return nodes === null ? domSelector.closest(selectors, this) : (nodes[0] || null);');
await writeFile(elementPath, elementSource);
/** NamedNodeMap remains a WebIDL wrapper over native collection operations. */
const namedMapPath = resolve(destination, 'lib/jsdom/living/attributes/NamedNodeMap-impl.js');
let namedMapSource = substituteOnce(await readFile(namedMapPath, 'utf8'),
  'const { HTML_NS } = require("../helpers/namespaces");',
  'const { domSymbolTree } = require("../helpers/internal-constants");');
namedMapSource = substituteOnce(namedMapSource, '    return this._attributeList.keys();',
  '    return domSymbolTree.attributeIndices(this._element);');
namedMapSource = substituteOnce(namedMapSource, '    return this._attributeList.length;',
  '    return domSymbolTree.attributeCount(this._element);');
namedMapSource = substituteOnce(namedMapSource,
  '    if (index >= this._attributeList.length) {\n      return null;\n    }\n    return this._attributeList[index];',
  '    return domSymbolTree.attributeAt(this._element, index);');
const supportedNamesStart = namedMapSource.indexOf('    const names = new Set(this._attributeList.map(a => a._qualifiedName));');
const supportedNamesEnd = namedMapSource.indexOf('    return names;', supportedNamesStart);
if (supportedNamesStart < 0 || supportedNamesEnd < supportedNamesStart) throw new Error('rustdom build: NamedNodeMap supported names boundary changed');
namedMapSource = namedMapSource.slice(0, supportedNamesStart) +
  '    return domSymbolTree.attributeNames(this._element, true);' + namedMapSource.slice(supportedNamesEnd + '    return names;'.length);
await writeFile(namedMapPath, namedMapSource);
const parentPath = resolve(destination, 'lib/jsdom/living/nodes/ParentNode-impl.js');
let parentSource = await readFile(parentPath, 'utf8');
parentSource = substituteOnce(parentSource, '    return domSelector.querySelector(selectors, this);',
  '    const nodes = domSymbolTree.queryFirst(selectors, this);\n    return nodes === null ? domSelector.querySelector(selectors, this) : (nodes[0] || null);');
parentSource = substituteOnce(parentSource, '    const nodes = domSelector.querySelectorAll(selectors, this);',
  '    const nativeNodes = domSymbolTree.queryAll(selectors, this);\n    const nodes = nativeNodes === null ? domSelector.querySelectorAll(selectors, this) : nativeNodes;');
await writeFile(parentPath, parentSource);
const characterPath = resolve(destination, 'lib/jsdom/living/nodes/CharacterData-impl.js');
let characterSource = await readFile(characterPath, 'utf8');
characterSource = substituteOnce(characterSource, 'const DOMException = require("../generated/DOMException");',
  'const DOMException = require("../generated/DOMException");\nconst { domSymbolTree } = require("../helpers/internal-constants");');
characterSource = substituteOnce(characterSource, '    this._data = privateData.data;',
  '    domSymbolTree.initializeCharacterData(this, privateData.nodeType, privateData.data);');
characterSource = substituteOnce(characterSource, '  // https://dom.spec.whatwg.org/#dom-characterdata-data',
  '  get _data() { return domSymbolTree.characterData(this); }\n' +
  '  set _data(value) { domSymbolTree.setCharacterData(this, value); }\n\n' +
  '  // https://dom.spec.whatwg.org/#dom-characterdata-data');
characterSource = substituteOnce(characterSource, '    return this._data.length;',
  '    return domSymbolTree.characterLength(this);');
characterSource = substituteOnce(characterSource,
  '    if (offset + count > length) {\n      return this._data.slice(offset);\n    }\n\n    return this._data.slice(offset, offset + count);',
  '    return domSymbolTree.substringData(this, offset, count);');
characterSource = substituteOnce(characterSource,
  '    queueMutationRecord(MUTATION_TYPE.CHARACTER_DATA, this, null, null, this._data, [], [], null, null);\n\n' +
  '    const start = this._data.slice(0, offset);\n    const end = this._data.slice(offset + count);\n    this._data = start + data + end;',
  '    const previous = domSymbolTree.replaceCharacterData(this, offset, count, data);\n' +
  '    queueMutationRecord(MUTATION_TYPE.CHARACTER_DATA, this, null, null, previous, [], [], null, null);');
await writeFile(characterPath, characterSource);
/** Supply final node kinds before subclass constructors assign their public fields. */
for (const [filename, kind] of [['Text', 'TEXT_NODE'], ['Comment', 'COMMENT_NODE']]) {
  const path = resolve(destination, `lib/jsdom/living/nodes/${filename}-impl.js`);
  let source = substituteOnce(await readFile(path, 'utf8'), '      data: args[0],',
    `      nodeType: NODE_TYPE.${kind},\n      data: args[0],`);
  if (filename === 'Text') {
    const start = source.indexOf('    let wholeText = this.textContent;');
    const end = source.indexOf('    return wholeText;', start);
    if (start < 0 || end < start) throw new Error('rustdom build: Text.wholeText boundary changed');
    source = source.slice(0, start) + '    return domSymbolTree.wholeText(this);' + source.slice(end + '    return wholeText;'.length);
  }
  await writeFile(path, source);
}
for (const [filename, kind] of [['CDATASection', 'CDATA_SECTION_NODE'], ['ProcessingInstruction', 'PROCESSING_INSTRUCTION_NODE']]) {
  const path = resolve(destination, `lib/jsdom/living/nodes/${filename}-impl.js`);
  let source = substituteOnce(await readFile(path, 'utf8'),
    '    super(globalObject, args, privateData);',
    `    super(globalObject, args, { ...privateData, nodeType: NODE_TYPE.${kind} });`);
  if (filename === 'ProcessingInstruction') {
    source = substituteOnce(source, 'const NODE_TYPE = require("../node-type");',
      'const NODE_TYPE = require("../node-type");\nconst { domSymbolTree } = require("../helpers/internal-constants");');
    source = substituteOnce(source, '    this._target = privateData.target;',
      '    domSymbolTree.initializeProcessingInstructionTarget(this, privateData.target);');
    source = substituteOnce(source, '  get target() {',
      '  get _target() { return domSymbolTree.processingInstructionTarget(this); }\n\n  get target() {');
  }
  await writeFile(path, source);
}
/** DocumentType stores immutable identifiers in Rust; JS only exposes existing WebIDL wrappers. */
const doctypePath = resolve(destination, 'lib/jsdom/living/nodes/DocumentType-impl.js');
let doctypeSource = substituteOnce(await readFile(doctypePath, 'utf8'),
  'const NODE_TYPE = require("../node-type");',
  'const NODE_TYPE = require("../node-type");\nconst { domSymbolTree } = require("../helpers/internal-constants");');
doctypeSource = substituteOnce(doctypeSource,
  '    this.name = privateData.name;\n    this.publicId = privateData.publicId;\n    this.systemId = privateData.systemId;',
  '    domSymbolTree.initializeDocumentType(this, privateData);');
doctypeSource = substituteOnce(doctypeSource, '\n}\n',
  '\n  get name() { return domSymbolTree.documentTypeName(this); }\n' +
  '  get publicId() { return domSymbolTree.documentTypePublicId(this); }\n' +
  '  get systemId() { return domSymbolTree.documentTypeSystemId(this); }\n}\n');
await writeFile(doctypePath, doctypeSource);
/** Remove upstream comparison algorithms once every public entry point uses native state. */
const nodePath = resolve(destination, 'lib/jsdom/living/nodes/Node-impl.js');
let nodeSource = await readFile(nodePath, 'utf8');
nodeSource = substituteOnce(nodeSource, 'const { simultaneousIterators } = require("../../utils");\n', '');
nodeSource = substituteOnce(nodeSource, 'const NODE_DOCUMENT_POSITION = require("../node-document-position");\n', '');
const equalityStart = nodeSource.indexOf('function nodeEquals(a, b) {');
const equalityEnd = nodeSource.indexOf('// https://dom.spec.whatwg.org/#concept-tree-host-including-inclusive-ancestor', equalityStart);
if (equalityStart < 0 || equalityEnd < equalityStart) throw new Error('rustdom build: Node equality boundary changed');
nodeSource = nodeSource.slice(0, equalityStart) + nodeSource.slice(equalityEnd);
const positionStart = nodeSource.indexOf('  compareDocumentPosition(other) {');
const positionEnd = nodeSource.indexOf('  lookupPrefix(namespace) {', positionStart);
if (positionStart < 0 || positionEnd < positionStart) throw new Error('rustdom build: Node position boundary changed');
nodeSource = nodeSource.slice(0, positionStart) +
  '  compareDocumentPosition(other) { return domSymbolTree.compareDocumentPosition(this, other); }\n\n' + nodeSource.slice(positionEnd);
nodeSource = substituteOnce(nodeSource, '    return isInclusiveAncestor(this, other);',
  '    return domSymbolTree.containsNode(this, other);');
const equalMethodStart = nodeSource.indexOf('  isEqualNode(node) {');
const equalMethodEnd = nodeSource.indexOf('  isSameNode(node) {', equalMethodStart);
if (equalMethodStart < 0 || equalMethodEnd < equalMethodStart) throw new Error('rustdom build: Node.isEqualNode boundary changed');
nodeSource = nodeSource.slice(0, equalMethodStart) +
  '  isEqualNode(node) { return domSymbolTree.equalNode(this, node); }\n\n' + nodeSource.slice(equalMethodEnd);
nodeSource = substituteOnce(nodeSource, 'const { clone, locateNamespacePrefix, locateNamespace } = require("../node");',
  'const { clone } = require("../node");');
const namespaceStart = nodeSource.indexOf('  lookupPrefix(namespace) {');
const namespaceEnd = nodeSource.indexOf('  contains(other) {', namespaceStart);
if (namespaceStart < 0 || namespaceEnd < namespaceStart) throw new Error('rustdom build: Node namespace boundary changed');
nodeSource = nodeSource.slice(0, namespaceStart) +
  '  lookupPrefix(namespace) { return domSymbolTree.lookupPrefix(this, namespace); }\n\n' +
  '  lookupNamespaceURI(prefix) { return domSymbolTree.lookupNamespaceURI(this, prefix); }\n\n' +
  '  isDefaultNamespace(namespace) { return domSymbolTree.isDefaultNamespace(this, namespace); }\n\n' + nodeSource.slice(namespaceEnd);
for (const property of ['nodeValue', 'textContent']) {
  const getterStart = nodeSource.indexOf(`  get ${property}() {`);
  const setterStart = nodeSource.indexOf(`  set ${property}(value) {`, getterStart);
  if (getterStart < 0 || setterStart < getterStart) throw new Error(`rustdom build: Node.${property} boundary changed`);
  nodeSource = nodeSource.slice(0, getterStart) +
    `  get ${property}() { return domSymbolTree.${property}(this); }\n\n` + nodeSource.slice(setterStart);
}
const normalizeStart = nodeSource.indexOf('  normalize() {');
const normalizeDataEnd = nodeSource.indexOf('      node.replaceData(length, 0, data);', normalizeStart);
if (normalizeStart < 0 || normalizeDataEnd < normalizeStart) throw new Error('rustdom build: Node.normalize planning boundary changed');
nodeSource = nodeSource.slice(0, normalizeStart) +
  '  normalize() {\n    for (const node of domSymbolTree.normalizationCandidates(this)) {\n' +
  '      const group = domSymbolTree.normalizationGroup(node);\n      if (group === null) continue;\n' +
  '      const parentNode = group.parent;\n      let length = group.originalLength;\n' +
  '      if (length === 0) { parentNode._remove(node); continue; }\n' +
  '      const continuousExclusiveTextNodes = group.siblings;\n' +
  '      const data = group.appendedData;\n' + nodeSource.slice(normalizeDataEnd);
const normalizationRangesStart = nodeSource.indexOf('      let currentNode = domSymbolTree.nextSibling(node);', normalizeStart);
const normalizationRangesEnd = nodeSource.indexOf('      for (const continuousExclusiveTextNode of continuousExclusiveTextNodes)', normalizationRangesStart);
if (normalizationRangesStart < 0 || normalizationRangesEnd < normalizationRangesStart) {
  throw new Error('rustdom build: Node.normalize range boundary changed');
}
const normalizationRanges = nodeSource.slice(normalizationRangesStart, normalizationRangesEnd).trimEnd();
// Check after replaceData: a synchronous hook can create live ranges before this point.
nodeSource = nodeSource.slice(0, normalizationRangesStart) +
  '      if (node._referencedRanges.size !== 0 || parentNode._referencedRanges.size !== 0) {\n' +
  normalizationRanges.split('\n').map((line) => `  ${line}`).join('\n') + '\n      }\n\n' +
  nodeSource.slice(normalizationRangesEnd);
await writeFile(nodePath, nodeSource);
/** All public namespace callers now reach Rust; remove the unused recursive helpers. */
const nodeHelpersPath = resolve(destination, 'lib/jsdom/living/node.js');
let nodeHelpers = await readFile(nodeHelpersPath, 'utf8');
const namespaceHelpersStart = nodeHelpers.indexOf('// https://dom.spec.whatwg.org/#locate-a-namespace-prefix');
if (namespaceHelpersStart < 0 || !nodeHelpers.slice(namespaceHelpersStart).includes('exports.locateNamespace =')) {
  throw new Error('rustdom build: namespace helpers boundary changed');
}
nodeHelpers = substituteOnce(nodeHelpers.slice(0, namespaceHelpersStart),
  'const { HTML_NS, XMLNS_NS } = require("./helpers/namespaces");', 'const { HTML_NS } = require("./helpers/namespaces");');
await writeFile(nodeHelpersPath, nodeHelpers);
const serializationPath = resolve(destination, 'lib/jsdom/living/domparsing/serialization.js');
await writeFile(serializationPath, substituteOnce(await readFile(serializationPath, 'utf8'),
  '    return outer ? parse5.serializeOuter(node, config) : parse5.serialize(node, config);',
  '    return domSymbolTree.serializeHTML(node, Boolean(outer), config.scriptingEnabled !== false);'));

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
await cp('src/index.mjs', 'dist/index.mjs');
await cp('src/native.mjs', 'dist/native.mjs');
await cp('src/private-require.cjs', 'dist/private-require.cjs');

/**
 * Preserve dependency resolution in non-hoisted installations without mutating Node's loader.
 * @param {string} directory - One directory in the owned private copy.
 * @returns {Promise<void>} Patches each CommonJS module's local require exactly once after copying.
 */
async function scopePrivateDependencies(directory) {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, file.name);
    if (file.isDirectory()) await scopePrivateDependencies(path);
    else if (file.name.endsWith('.js')) {
      const source = await readFile(path, 'utf8');
      const helper = relative(dirname(path), resolve('dist/private-require.cjs')).split(sep).join('/');
      const injection = `\nrequire = require(${JSON.stringify(helper)})(require);\n`;
      // Comments may precede the directive; keep it in the directive prologue.
      const strict = /^(?:(?:\s+)|(?:\/\/[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/))*["']use strict["'];/.exec(source);
      const offset = strict?.[0].length || 0;
      await writeFile(path, source.slice(0, offset) + injection + source.slice(offset));
    }
  }
}
await scopePrivateDependencies(resolve(destination, 'lib'));
