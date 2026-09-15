/** @file Builds the pinned private jsdom runtime and integrates native DOM operations. */
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, relative, sep } from 'node:path';
import { patchEventDispatch, replaceRegion } from './build-event-dispatch.mjs';
import { patchEventListeners } from './build-event-listeners.mjs';

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
const xmlSerializerAdapter = await readFile('src/dom/xml-serializer.cjs', 'utf8');
await writeFile('dist/xml-serializer.cjs', substituteOnce(xmlSerializerAdapter, "require('../../dist/native.cjs')", "require('./native.cjs')"));
for (const file of ['serialization.js', 'XMLSerializer-impl.js']) {
  const serializerPath = resolve(destination, 'lib/jsdom/living/domparsing', file);
  await writeFile(serializerPath, substituteOnce(await readFile(serializerPath, 'utf8'), 'require("w3c-xmlserializer")', 'require("../../../../../xml-serializer.cjs")'));
}
await mkdir('dist/compatibility-licenses/w3c-xmlserializer', { recursive: true });
await cp('third-party/w3c-xmlserializer/LICENSE.md', 'dist/compatibility-licenses/w3c-xmlserializer/LICENSE.md');
const xmlAdapter = await readFile('src/parser/xml.cjs', 'utf8');
await writeFile('dist/xml-parser.cjs', substituteOnce(xmlAdapter, "require('../../dist/native.cjs')", "require('./native.cjs')"));
const xmlParserPath = resolve(destination, 'lib/jsdom/browser/parser/xml.js');
let xmlParserSource = substituteOnce(await readFile(xmlParserPath, 'utf8'),
  'const { SaxesParser } = require("saxes");', 'const { SaxesParser } = require("../../../../../xml-parser.cjs");');
xmlParserSource = replaceRegion(xmlParserSource, 'const HTML5_DOCTYPE =', 'function createDocumentType(', '', substituteOnce);
xmlParserSource = replaceRegion(xmlParserSource, '  parser.on("doctype", dt => {', '  parser.on("error", err => {',
  '  parser.on("doctype", dt => {\n' +
  '    const ownerDocument = getOwnerDocument();\n    const declaration = parser.describeDoctype(dt);\n' +
  '    if (declaration === null) return declaration[1];\n' +
  '    appendChild(createDocumentType(globalObject, ownerDocument, declaration.name, declaration.publicId, declaration.systemId));\n' +
  '    parser.applyDoctypeEntities(dt);\n  });\n\n', substituteOnce);
await writeFile(xmlParserPath, xmlParserSource);
await mkdir('dist/compatibility-licenses/saxes', { recursive: true });
await cp('third-party/saxes/LICENSE', 'dist/compatibility-licenses/saxes/LICENSE');

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
await cp('src/dom/range-state.cjs', 'dist/range-state.cjs');
await cp('src/dom/range-errors.cjs', 'dist/range-errors.cjs');
await cp('src/dom/mutation-record.cjs', 'dist/mutation-record.cjs');
const formDataAdapter = await readFile('src/dom/form-data.cjs', 'utf8');
await writeFile('dist/form-data.cjs', substituteOnce(formDataAdapter, "require('../../dist/native.cjs')", "require('./native.cjs')"));
const formDataPath = resolve(destination, 'lib/jsdom/living/xhr/FormData-impl.js');
await writeFile(formDataPath, '"use strict";\nexports.implementation = require("../../../../../form-data.cjs").createFormDataImplementation({\n' +
  ' DOMException: require("../generated/DOMException"), idlUtils: require("../generated/utils"),\n' +
  ' ...require("../helpers/form-controls"), closest: require("../helpers/traversal").closest,\n' +
  ' Blob: require("../generated/Blob.js"), File: require("../generated/File.js")\n});\n');
const generatedFormDataPath = resolve(destination, 'lib/jsdom/living/generated/FormData.js');
let generatedFormData = await readFile(generatedFormDataPath, 'utf8');
generatedFormData = substituteOnce(generatedFormData, '      let pairs = Array.from(this[implSymbol]);', '      let pair;');
generatedFormData = substituteOnce(generatedFormData, '      while (i < pairs.length) {', '      while ((pair = this[implSymbol]._entryAt(i)) !== null) {');
generatedFormData = substituteOnce(generatedFormData, '        const [key, value] = pairs[i].map(utils.tryWrapperForImpl);', '        const [key, value] = pair.map(utils.tryWrapperForImpl);');
generatedFormData = substituteOnce(generatedFormData, '        pairs = Array.from(this[implSymbol]);\n', '');
generatedFormData = substituteOnce(generatedFormData, '      const values = Array.from(target[implSymbol]);\n      const len = values.length;\n      if (index >= len) {', '      const pair = target[implSymbol]._entryAt(index);\n      if (pair === null) {');
generatedFormData = substituteOnce(generatedFormData, '      const pair = values[index];\n', '');
await writeFile(generatedFormDataPath, generatedFormData);
const readerSource = await readFile('src/dom/file-reader.cjs', 'utf8');
await writeFile('dist/file-reader.cjs', substituteOnce(readerSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/file-api/FileReader-impl.js'),
  '"use strict";\nconst { createFileReaderImplementation } = require("../../../../../file-reader.cjs");\n' +
  'exports.implementation = createFileReaderImplementation({\n' +
  ' EventTargetImpl: require("../events/EventTarget-impl").implementation, DOMException: require("../generated/DOMException"),\n' +
  ' ProgressEvent: require("../generated/ProgressEvent"), fireAnEvent: require("../helpers/events").fireAnEvent,\n' +
  ' setupForSimpleEventAccessors: require("../helpers/create-event-accessor").setupForSimpleEventAccessors,\n' +
  ' MIMEType: require("whatwg-mimetype"), ...require("@exodus/bytes/encoding.js"),\n' +
  ' copyToArrayBufferInNewRealm: require("../helpers/binary-data").copyToArrayBufferInNewRealm\n});\n');
const blobSource = await readFile('src/dom/blob-file.cjs', 'utf8');
await writeFile('dist/blob-file.cjs', substituteOnce(blobSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/file-api/Blob-impl.js'),
  '"use strict";\nconst { createBlobImplementation } = require("../../../../../blob-file.cjs");\n' +
  'exports.implementation = createBlobImplementation(require("../generated/Blob"), require("../generated/utils").isArrayBuffer);\n');
await writeFile(resolve(destination, 'lib/jsdom/living/file-api/File-impl.js'),
  '"use strict";\nconst { createFileImplementation } = require("../../../../../blob-file.cjs");\n' +
  'exports.implementation = createFileImplementation(require("./Blob-impl").implementation);\n');
const storageSource = await readFile('src/dom/web-storage.cjs', 'utf8');
await writeFile('dist/web-storage.cjs', substituteOnce(storageSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/webstorage/Storage-impl.js'),
  '"use strict";\nconst { createStorageImplementation } = require("../../../../../web-storage.cjs");\n' +
  'exports.implementation = createStorageImplementation(require("../generated/DOMException"), require("../generated/StorageEvent"), require("../generated/utils"), require("../helpers/events").fireAnEvent);\n');
const storageWindowPath = resolve(destination, 'lib/jsdom/browser/Window.js');
let storageWindowSource = await readFile(storageWindowPath, 'utf8');
storageWindowSource = substituteOnce(storageWindowSource, 'const Storage = require("../living/generated/Storage");',
  'const Storage = require("../living/generated/Storage");\nconst { NativeStorageArea } = require("../../../../native.cjs");');
for (const area of ['localStorageArea', 'sessionStorageArea']) storageWindowSource = substituteOnce(storageWindowSource, `${area}: new Map()`, `${area}: new NativeStorageArea()`);
await writeFile(storageWindowPath, storageWindowSource);
const rectSource = await readFile('src/dom/dom-rect.cjs', 'utf8');
await writeFile('dist/dom-rect.cjs', substituteOnce(rectSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/geometry/DOMRectReadOnly-impl.js'),
  '"use strict";\nconst { createReadOnlyRectImplementation } = require("../../../../../dom-rect.cjs");\n' +
  'exports.implementation = createReadOnlyRectImplementation(require("../generated/DOMRectReadOnly"));\n');
await writeFile(resolve(destination, 'lib/jsdom/living/geometry/DOMRect-impl.js'),
  '"use strict";\nconst { createMutableRectImplementation } = require("../../../../../dom-rect.cjs");\n' +
  'exports.implementation = createMutableRectImplementation(require("./DOMRectReadOnly-impl").implementation, require("../generated/DOMRect"));\n');
const tokenListSource = await readFile('src/dom/token-list.cjs', 'utf8');
const stringMapSource = await readFile('src/dom/string-map.cjs', 'utf8');
await writeFile('dist/string-map.cjs', substituteOnce(stringMapSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/nodes/DOMStringMap-impl.js'),
  '"use strict";\nconst { createStringMapImplementation } = require("../../../../../string-map.cjs");\n' +
  'const { domSymbolTree } = require("../helpers/internal-constants");\nconst DOMException = require("../generated/DOMException");\n' +
  'const idlUtils = require("../generated/utils");\nconst attributes = require("../attributes.js");\n' +
  'exports.implementation = createStringMapImplementation(domSymbolTree, DOMException, idlUtils, attributes);\n');
await writeFile('dist/token-list.cjs', substituteOnce(tokenListSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/nodes/DOMTokenList-impl.js'),
  '"use strict";\nconst { createTokenListImplementation } = require("../../../../../token-list.cjs");\n' +
  'const { domSymbolTree } = require("../helpers/internal-constants");\nconst DOMException = require("../generated/DOMException");\n' +
  'const idlUtils = require("../generated/utils");\nconst { setAttributeValue } = require("../attributes.js");\n' +
  'exports.implementation = createTokenListImplementation(domSymbolTree, DOMException, idlUtils, setAttributeValue);\n');
const traversalSource = await readFile('src/dom/tree-cursor.cjs', 'utf8');
await writeFile('dist/tree-cursor.cjs', substituteOnce(traversalSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
for (const implementation of ['NodeIterator', 'TreeWalker']) {
  await writeFile(resolve(destination, `lib/jsdom/living/traversal/${implementation}-impl.js`),
    '"use strict";\nconst { createTraversalImplementations } = require("../../../../../tree-cursor.cjs");\n' +
    'const { domSymbolTree } = require("../helpers/internal-constants");\nconst DOMException = require("../generated/DOMException");\n' +
    `exports.implementation = createTraversalImplementations(domSymbolTree, DOMException).${implementation}Impl;\n`);
}
const mutationRecordPath = resolve(destination, 'lib/jsdom/living/mutation-observer/MutationRecord-impl.js');
await writeFile(mutationRecordPath, '"use strict";\n' +
  'const { createMutationRecordImplementation } = require("../../../../../mutation-record.cjs");\n' +
  'const NodeList = require("../generated/NodeList");\n' +
  'const { domSymbolTree } = require("../helpers/internal-constants");\n' +
  'module.exports = { implementation: createMutationRecordImplementation(NodeList, domSymbolTree) };\n');
await cp('src/dom/mutation-observer.cjs', 'dist/mutation-observer.cjs');
const eventStateSource = await readFile('src/dom/event-state.cjs', 'utf8');
await writeFile('dist/event-state.cjs', substituteOnce(eventStateSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
const eventPath = resolve(destination, 'lib/jsdom/living/events/Event-impl.js');
let eventSource = await readFile(eventPath, 'utf8');
eventSource = substituteOnce(eventSource, 'const EventInit = require("../generated/EventInit");',
  'const EventInit = require("../generated/EventInit");\nconst { createNativeEvent, nativeEventInitFields, installNativeEventProperties } = require("../../../../../event-state.cjs");');
const eventConstructorStart = eventSource.indexOf('    this.type = type;');
const eventConstructorEnd = eventSource.indexOf('    this.timeStamp = Date.now();', eventConstructorStart) + '    this.timeStamp = Date.now();'.length;
if (eventConstructorStart < 0 || eventConstructorEnd < eventConstructorStart) throw new Error('rustdom build: missing Event constructor boundary');
eventSource = substituteOnce(eventSource, eventSource.slice(eventConstructorStart, eventConstructorEnd),
  '    this._eventState = createNativeEvent(type, eventInitDict, this.constructor.defaultInit);\n' +
  '    for (const key in eventInitDict) {\n      if (!nativeEventInitFields.has(key)) this[key] = eventInitDict[key];\n    }\n' +
  '    for (const key in this.constructor.defaultInit) {\n      if (!(key in eventInitDict) && !nativeEventInitFields.has(key)) this[key] = this.constructor.defaultInit[key];\n    }\n' +
  '    this.target = null;\n    this.currentTarget = null;\n    this._globalObject = globalObject;\n    this._path = [];\n' +
  '    this._eventState.finishConstruction(Boolean(privateData.isTrusted), Date.now());');
eventSource = substituteOnce(eventSource, '    if (this.cancelable && !this._inPassiveListenerFlag) {\n      this._canceledFlag = true;\n    }', '    this._eventState.preventDefault();');
eventSource = substituteOnce(eventSource, '    return !this._canceledFlag;', '    return this._eventState.returnValue;');
eventSource = substituteOnce(eventSource, '    if (v === false) {\n      this._setTheCanceledFlag();\n    }', '    this._eventState.setReturnValue(v);');
eventSource = substituteOnce(eventSource, '  stopPropagation() {\n    this._stopPropagationFlag = true;\n  }', '  stopPropagation() {\n    this._eventState.stopPropagation();\n  }');
eventSource = substituteOnce(eventSource, '    if (v) {\n      this._stopPropagationFlag = true;\n    }', '    this._eventState.setCancelBubble(v);');
eventSource = substituteOnce(eventSource, '    this._stopPropagationFlag = true;\n    this._stopImmediatePropagationFlag = true;', '    this._eventState.stopImmediatePropagation();');
const eventInitializeStart = eventSource.indexOf('  _initialize(type, bubbles, cancelable) {');
const eventInitializeEnd = eventSource.indexOf('  initEvent(type, bubbles, cancelable) {', eventInitializeStart);
if (eventInitializeStart < 0 || eventInitializeEnd < eventInitializeStart) throw new Error('rustdom build: missing Event initialization boundary');
eventSource = substituteOnce(eventSource, eventSource.slice(eventInitializeStart, eventInitializeEnd),
  '  _initialize(type, bubbles, cancelable) {\n    this._eventState.initialize(type, bubbles, cancelable);\n    this.target = null;\n  }\n\n');
eventSource = substituteOnce(eventSource, '    if (this._dispatchFlag) {\n      return;\n    }\n\n    this._initialize(type, bubbles, cancelable);',
  '    if (this._eventState.initializeIfIdle(type, bubbles, cancelable)) this.target = null;');
eventSource = substituteOnce(eventSource, 'EventImpl.defaultInit = EventInit.convert(undefined, undefined);',
  'installNativeEventProperties(EventImpl);\nEventImpl.defaultInit = EventInit.convert(undefined, undefined);');
const eventTargetPath = resolve(destination, 'lib/jsdom/living/events/EventTarget-impl.js');
const eventDispatchSources = patchEventDispatch(eventSource, await readFile(eventTargetPath, 'utf8'), substituteOnce);
await writeFile(eventPath, eventDispatchSources.eventSource);
await writeFile(eventTargetPath, patchEventListeners(eventDispatchSources.targetSource, substituteOnce));
const eventListenersSource = await readFile('src/dom/event-listeners.cjs', 'utf8');
await writeFile('dist/event-listeners.cjs', substituteOnce(eventListenersSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
const listenerWindowPath = resolve(destination, 'lib/jsdom/browser/Window.js');
let listenerWindowSource = await readFile(listenerWindowPath, 'utf8');
listenerWindowSource = substituteOnce(listenerWindowSource, '"use strict";',
  '"use strict";\nconst { createListenerStorage } = require("../../../../event-listeners.cjs");');
for (const receiver of ['window', 'window._document']) listenerWindowSource = substituteOnce(listenerWindowSource,
  `idlUtils.implForWrapper(${receiver})._eventListeners = Object.create(null);`,
  `idlUtils.implForWrapper(${receiver})._eventListeners = createListenerStorage();`);
await writeFile(listenerWindowPath, listenerWindowSource);
const listenerSocketPath = resolve(destination, 'lib/jsdom/living/websockets/WebSocket-impl.js');
let listenerSocketSource = await readFile(listenerSocketPath, 'utf8');
listenerSocketSource = substituteOnce(listenerSocketSource, '"use strict";',
  '"use strict";\nconst { createListenerStorage } = require("../../../../../event-listeners.cjs");');
listenerSocketSource = substituteOnce(listenerSocketSource, '    this._eventListeners = Object.create(null);', '    this._eventListeners = createListenerStorage();');
await writeFile(listenerSocketPath, listenerSocketSource);
const listenerXhrPath = resolve(destination, 'lib/jsdom/living/xhr/XMLHttpRequest-impl.js');
await writeFile(listenerXhrPath, substituteOnce(await readFile(listenerXhrPath, 'utf8'),
  'Object.keys(upload._eventListeners).length > 0', 'upload._eventListeners.hasEventTypes'));
const listenerFramePath = resolve(destination, 'lib/jsdom/living/nodes/HTMLFrameElement-impl.js');
await writeFile(listenerFramePath, substituteOnce(await readFile(listenerFramePath, 'utf8'),
  'Object.keys(frame._eventListeners).length === 0', '!frame._eventListeners.hasEventTypes'));
const mutationObserverPath = resolve(destination, 'lib/jsdom/living/mutation-observer/MutationObserver-impl.js');
const abortSignalSource = await readFile('src/dom/abort-signal.cjs', 'utf8');
await writeFile('dist/abort-signal.cjs', substituteOnce(abortSignalSource, "require('../../dist/native.cjs')", "require('./native.cjs')"));
await writeFile(resolve(destination, 'lib/jsdom/living/aborting/AbortSignal-impl.js'),
  '"use strict";\nconst { createAbortSignalImplementation } = require("../../../../../abort-signal.cjs");\n' +
  'const EventTargetImpl = require("../events/EventTarget-impl").implementation;\n' +
  'const AbortSignal = require("../generated/AbortSignal");\nconst DOMException = require("../generated/DOMException");\n' +
  'const { fireAnEvent } = require("../helpers/events");\nconst { setupForSimpleEventAccessors } = require("../helpers/create-event-accessor");\n' +
  'module.exports = { implementation: createAbortSignalImplementation(EventTargetImpl, AbortSignal, DOMException, fireAnEvent, setupForSimpleEventAccessors) };\n');
await writeFile(mutationObserverPath, '"use strict";\n' +
  'const { createMutationObserverImplementation } = require("../../../../../mutation-observer.cjs");\n' +
  'const { wrapperForImpl } = require("../generated/utils");\n' +
  'const { domSymbolTree } = require("../helpers/internal-constants");\n' +
  'module.exports = { implementation: createMutationObserverImplementation(domSymbolTree, wrapperForImpl) };\n');
const contentDriverSource = await readFile('src/dom/range-content-driver.cjs', 'utf8');
await writeFile('dist/range-content-driver.cjs', substituteOnce(contentDriverSource,
  "require('../../dist/native.cjs')", "require('./native.cjs')"));

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
const characterRangesStart = characterSource.indexOf('    for (const range of this._liveRanges()) {');
const characterRangesEnd = characterSource.indexOf('    if (this.nodeType === TEXT_NODE && this.parentNode)', characterRangesStart);
if (characterRangesStart < 0 || characterRangesEnd < characterRangesStart) throw new Error('rustdom build: CharacterData Range adjustment boundary changed');
characterSource = characterSource.slice(0, characterRangesStart) +
  '    domSymbolTree.adjustCharacterDataRanges(this, offset, count, data.length);\n\n' + characterSource.slice(characterRangesEnd);
await writeFile(characterPath, characterSource);
/** Supply final node kinds before subclass constructors assign their public fields. */
for (const [filename, kind] of [['Text', 'TEXT_NODE'], ['Comment', 'COMMENT_NODE']]) {
  const path = resolve(destination, `lib/jsdom/living/nodes/${filename}-impl.js`);
  let source = substituteOnce(await readFile(path, 'utf8'), '      data: args[0],',
    `      nodeType: NODE_TYPE.${kind},\n      data: args[0],`);
  if (filename === 'Text') {
    const splitRangesStart = source.indexOf('      for (const range of this._liveRanges()) {');
    const splitIndex = source.indexOf('      const nodeIndex = domSymbolTree.index(this);', splitRangesStart);
    const splitRangesEnd = source.indexOf('\n    }\n\n    this.replaceData(offset, count, "");', splitIndex);
    if (splitRangesStart < 0 || splitIndex < splitRangesStart || splitRangesEnd < splitIndex) throw new Error('rustdom build: splitText Range adjustment boundary changed');
    source = source.slice(0, splitRangesStart) +
      '      domSymbolTree.adjustSplitTextRanges(this, newNode, offset);\n' +
      '      const nodeIndex = domSymbolTree.index(this);\n' +
      '      domSymbolTree.adjustSplitParentRanges(parent, nodeIndex);' + source.slice(splitRangesEnd);
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
nodeSource = substituteOnce(nodeSource, '    this._registeredObserverList = [];', '    this._observerOwners = new Set();');
nodeSource = substituteOnce(nodeSource, 'const NODE_DOCUMENT_POSITION = require("../node-document-position");\n', '');
const equalityStart = nodeSource.indexOf('function nodeEquals(a, b) {');
const equalityEnd = nodeSource.indexOf('// https://dom.spec.whatwg.org/#concept-tree-host-including-inclusive-ancestor', equalityStart);
if (equalityStart < 0 || equalityEnd < equalityStart) throw new Error('rustdom build: Node equality boundary changed');
nodeSource = nodeSource.slice(0, equalityStart) + nodeSource.slice(equalityEnd);
const hostAncestorStart = nodeSource.indexOf('function isHostInclusiveAncestor(nodeImplA, nodeImplB) {');
const hostAncestorEnd = nodeSource.indexOf('\nclass NodeImpl ', hostAncestorStart);
if (hostAncestorStart < 0 || hostAncestorEnd < hostAncestorStart) throw new Error('rustdom build: host ancestor helper boundary changed');
nodeSource = nodeSource.slice(0, hostAncestorStart) +
  'function isHostInclusiveAncestor(nodeImplA, nodeImplB) { return domSymbolTree.isHostInclusiveAncestor(nodeImplA, nodeImplB); }\n' + nodeSource.slice(hostAncestorEnd);
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
/** Keep WebIDL conversion and observable hooks while Rust selects each text setter effect. */
for (const property of ['nodeValue', 'textContent']) {
  const setterStart = nodeSource.indexOf(`  set ${property}(value) {`);
  const setterEnd = nodeSource.indexOf('\n  }', setterStart);
  if (setterStart < 0 || setterEnd < setterStart) throw new Error(`rustdom build: Node.${property} setter boundary changed`);
  nodeSource = nodeSource.slice(0, setterStart) +
    `  set ${property}(value) { domSymbolTree.setNodeText(this, value, ${property === 'textContent'}, setAnExistingAttributeValue); }` +
    nodeSource.slice(setterEnd + '\n  }'.length);
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
let normalizationRanges = nodeSource.slice(normalizationRangesStart, normalizationRangesEnd).trimEnd();
const normalizedUpdatesStart = normalizationRanges.indexOf('        for (const range of node._liveRanges()) {');
const normalizedUpdatesEnd = normalizationRanges.indexOf('        length += nodeLength(currentNode);', normalizedUpdatesStart);
if (normalizedUpdatesStart < 0 || normalizedUpdatesEnd < normalizedUpdatesStart) throw new Error('rustdom build: normalize Range updates changed');
normalizationRanges = normalizationRanges.slice(0, normalizedUpdatesStart) +
  '        domSymbolTree.adjustNormalizedTextRanges(node, currentNode, length);\n' +
  '        domSymbolTree.adjustNormalizedParentRanges(parentNode, node, currentNodeIndex, length);\n\n' +
  normalizationRanges.slice(normalizedUpdatesEnd);
// Check after replaceData: a synchronous hook can create live ranges before this point.
nodeSource = nodeSource.slice(0, normalizationRangesStart) +
  '      if (node._referencedRanges.size !== 0 || parentNode._referencedRanges.size !== 0) {\n' +
  normalizationRanges.split('\n').map((line) => `  ${line}`).join('\n') + '\n      }\n\n' +
  nodeSource.slice(normalizationRangesEnd);
/** Preserve parent/host-cycle gates before delegating the remaining insertion constraints. */
const nodePreInsertStart = nodeSource.indexOf('  _preInsertValidity(nodeImpl, childImpl) {');
const nodePreInsertEnd = nodeSource.indexOf('\n  }\n', nodePreInsertStart);
const preInsertConstraintsStart = nodeSource.indexOf('    if (childImpl && domSymbolTree.parent(childImpl) !== this) {', nodePreInsertStart);
if (nodePreInsertStart < 0 || preInsertConstraintsStart < nodePreInsertStart || nodePreInsertEnd < preInsertConstraintsStart) {
  throw new Error('rustdom build: Node pre-insertion constraint boundaries changed');
}
const preInsertPrefix = substituteOnce(nodeSource.slice(nodePreInsertStart, preInsertConstraintsStart),
  '    const { nodeType } = nodeImpl;\n', '');
nodeSource = nodeSource.slice(0, nodePreInsertStart) + preInsertPrefix +
  '    domSymbolTree.validateInsertionConstraints(this, nodeImpl, childImpl, DOMException);' + nodeSource.slice(nodePreInsertEnd);
const insertMethod = nodeSource.indexOf('  _insert(nodeImpl, childImpl, suppressObservers) {');
const insertedRangesStart = nodeSource.indexOf('      for (const range of this._liveRanges()) {', insertMethod);
const insertedRangesEnd = nodeSource.indexOf('\n    }\n\n    const nodesImpl =', insertedRangesStart);
if (insertMethod < 0 || insertedRangesStart < insertMethod || insertedRangesEnd < insertedRangesStart) throw new Error('rustdom build: inserted Range updates changed');
nodeSource = nodeSource.slice(0, insertedRangesStart) +
  '      domSymbolTree.adjustInsertedRanges(this, childIndex, count);' + nodeSource.slice(insertedRangesEnd);
const removeMethod = nodeSource.indexOf('  _remove(nodeImpl, suppressObservers) {');
const removedRangesStart = nodeSource.indexOf('    for (const descendant of domSymbolTree.treeIterator(nodeImpl)) {', removeMethod);
const removedRangesEnd = nodeSource.indexOf('    if (this._ownerDocument) {', removedRangesStart);
if (removeMethod < 0 || removedRangesStart < removeMethod || removedRangesEnd < removedRangesStart) throw new Error('rustdom build: removed Range updates changed');
nodeSource = nodeSource.slice(0, removedRangesStart) +
  '    for (const descendant of domSymbolTree.treeIterator(nodeImpl)) {\n' +
  '      domSymbolTree.adjustRemovedDescendantRanges(descendant, this, index);\n    }\n' +
  '    domSymbolTree.adjustRemovedParentRanges(this, index);\n\n' + nodeSource.slice(removedRangesEnd);
/** Replacement retains its own Document rules and the original effects after validation. */
const nodeReplacementStart = nodeSource.indexOf('  _replace(nodeImpl, childImpl) {');
const nodeReplacementConstraintsStart = nodeSource.indexOf('    if (childImpl && domSymbolTree.parent(childImpl) !== this) {', nodeReplacementStart);
const nodeReplacementEffectsStart = nodeSource.indexOf('    let referenceChildImpl = domSymbolTree.nextSibling(childImpl);', nodeReplacementStart);
if (nodeReplacementStart < 0 || nodeReplacementConstraintsStart < nodeReplacementStart || nodeReplacementEffectsStart < nodeReplacementConstraintsStart) {
  throw new Error('rustdom build: Node replacement constraint boundaries changed');
}
const nodeReplacementPrefix = substituteOnce(nodeSource.slice(nodeReplacementStart, nodeReplacementConstraintsStart),
  '    const { nodeType, nodeName } = nodeImpl;\n', '');
nodeSource = nodeSource.slice(0, nodeReplacementStart) + nodeReplacementPrefix +
  '    domSymbolTree.validateReplacementConstraints(this, nodeImpl, childImpl, DOMException);\n\n' + nodeSource.slice(nodeReplacementEffectsStart);
if (!nodeSource.includes('this._assignedNodes.length')) throw new Error('rustdom build: Node assignment-count reads changed');
nodeSource = nodeSource.replaceAll('this._assignedNodes.length', 'domSymbolTree.assignedNodeCount(this)');
/** Route all internal backlink readers/writers through Node's accessor, preserving subclass overrides. */
const nodeEventParent = '  _getTheParent() {\n    if (this._assignedSlot) {\n      return this._assignedSlot;\n    }\n\n    return domSymbolTree.parent(this);\n  }';
nodeSource = substituteOnce(nodeSource, nodeEventParent,
  '  get _assignedSlot() { return domSymbolTree.slotBacklink(this); }\n' +
  '  set _assignedSlot(slot) { domSymbolTree.setSlotBacklink(this, slot); }\n' +
  '  _getTheParent() { return domSymbolTree.eventParent(this); }');
await writeFile(nodePath, nodeSource);
const boundaryPointPath = resolve(destination, 'lib/jsdom/living/range/boundary-point.js');
let boundaryPointSource = await readFile(boundaryPointPath, 'utf8');
boundaryPointSource = substituteOnce(boundaryPointSource,
  'const { nodeRoot, isFollowing, isInclusiveAncestor } = require("../helpers/node");\n', '');
const boundaryPointStart = boundaryPointSource.indexOf('function compareBoundaryPointsPosition(bpA, bpB) {');
const boundaryPointEnd = boundaryPointSource.indexOf('module.exports = {', boundaryPointStart);
if (boundaryPointStart < 0 || boundaryPointEnd < boundaryPointStart) throw new Error('rustdom build: boundary-point comparator changed');
boundaryPointSource = boundaryPointSource.slice(0, boundaryPointStart) +
  'function compareBoundaryPointsPosition(bpA, bpB) {\n' +
  '  return domSymbolTree.compareBoundaryPointsPosition(bpA, bpB);\n}\n\n' + boundaryPointSource.slice(boundaryPointEnd);
await writeFile(boundaryPointPath, boundaryPointSource);
const abstractRangePath = resolve(destination, 'lib/jsdom/living/range/AbstractRange-impl.js');
const abstractRangeSource = await readFile(abstractRangePath, 'utf8');
if (!abstractRangeSource.includes('class AbstractRangeImpl') ||
    !abstractRangeSource.includes('    this._start = start;\n    this._end = end;')) {
  throw new Error('rustdom build: AbstractRange state initialization changed');
}
await writeFile(abstractRangePath, '"use strict";\n' +
  'const { domSymbolTree } = require("../helpers/internal-constants");\n' +
  'const { createAbstractRange } = require("../../../../../range-state.cjs");\n' +
  'module.exports = { implementation: createAbstractRange(domSymbolTree) };\n');
const rangePath = resolve(destination, 'lib/jsdom/living/range/Range-impl.js');
let rangeSource = await readFile(rangePath, 'utf8');
rangeSource = substituteOnce(rangeSource, '    this._weakRef = new WeakRef(this);',
  '    this._weakRef = new WeakRef(this);\n    domSymbolTree.registerLiveRange(this);\n' +
  '    if (privateData.nativeCopy) { domSymbolTree.attachRangeCopy(this); return; }');
const liveRangeStart = rangeSource.indexOf('  _setLiveRangeStart(node, offset) {');
const liveRangeEnd = rangeSource.indexOf('\n}\n\n\nfunction nextNodeDescendant', liveRangeStart);
if (liveRangeStart < 0 || liveRangeEnd < liveRangeStart) throw new Error('rustdom build: live Range state boundary changed');
rangeSource = rangeSource.slice(0, liveRangeStart) +
  '  _setLiveRangeStart(node, offset) { domSymbolTree.setLiveRangeStart(this, node, offset); }\n' +
  '  _setLiveRangeEnd(node, offset) { domSymbolTree.setLiveRangeEnd(this, node, offset); }\n' + rangeSource.slice(liveRangeEnd);
/** Keep only live-reference delivery in JS; Rust selects boundaries and their update order. */
const rangeSettersStart = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-commonancestorcontainer');
const rangeSettersEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-compareboundarypoints', rangeSettersStart);
const rangeCollapseStart = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-collapse', rangeSettersStart);
const rangeCollapseEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-selectnode', rangeCollapseStart);
if (rangeSettersStart < 0 || rangeSettersEnd < rangeSettersStart || rangeCollapseStart < rangeSettersStart || rangeCollapseEnd < rangeCollapseStart) {
  throw new Error('rustdom build: Range setter boundaries changed');
}
const rangeCollapse = '  collapse(toStart) { domSymbolTree.collapseRange(this, toStart); }\n\n';
rangeSource = rangeSource.slice(0, rangeSettersStart) +
  '  get commonAncestorContainer() { return domSymbolTree.rangeCommonAncestor(this); }\n\n' +
  '  setStart(node, offset) { setBoundaryPointStart(this, node, offset); }\n' +
  '  setEnd(node, offset) { setBoundaryPointEnd(this, node, offset); }\n' +
  ['StartBefore', 'StartAfter', 'EndBefore', 'EndAfter'].map((mode) =>
    `  set${mode}(node) { domSymbolTree.setRangeBoundary(this, node, 0, "${mode}", DOMException); }\n`).join('') +
  '\n' + rangeCollapse +
  '  selectNode(node) { selectNodeWithinRange(node, this); }\n' +
  '  selectNodeContents(node) { domSymbolTree.setRangeBoundary(this, node, 0, "SelectContents", DOMException); }\n\n' +
  rangeSource.slice(rangeSettersEnd);
const rangeComparisonStart = rangeSource.indexOf('  compareBoundaryPoints(how, sourceRange) {');
const rangeComparisonEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-deletecontents', rangeComparisonStart);
if (rangeComparisonStart < 0 || rangeComparisonEnd < rangeComparisonStart) throw new Error('rustdom build: Range comparison boundary changed');
rangeSource = rangeSource.slice(0, rangeComparisonStart) +
  '  compareBoundaryPoints(how, sourceRange) { return domSymbolTree.compareRanges(this, how, sourceRange, DOMException); }\n\n' +
  rangeSource.slice(rangeComparisonEnd);
const rangeDeleteStart = rangeSource.indexOf('  deleteContents() {');
const rangeDeleteEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-extractcontents', rangeDeleteStart);
if (rangeDeleteStart < 0 || rangeDeleteEnd < rangeDeleteStart) throw new Error('rustdom build: Range deletion boundary changed');
rangeSource = rangeSource.slice(0, rangeDeleteStart) +
  '  deleteContents() {\n' +
  '    const plan = domSymbolTree.rangeDeletionPlan(this);\n    if (!plan) return;\n' +
  '    if (plan.characterDataOnly) {\n      plan.startNode.replaceData(plan.startOffset, plan.startCount, "");\n      return;\n    }\n' +
  '    if (plan.startCharacter) plan.startNode.replaceData(plan.startOffset, plan.startCount, "");\n' +
  '    for (const node of plan.nodes) {\n      const parent = domSymbolTree.parent(node);\n      parent.removeChild(node);\n    }\n' +
  '    if (plan.endCharacter) plan.endNode.replaceData(0, plan.endOffset, "");\n' +
  '    this._setLiveRangeStart(plan.collapseNode, plan.collapseOffset);\n' +
  '    this._setLiveRangeEnd(plan.collapseNode, plan.collapseOffset);\n  }\n\n' + rangeSource.slice(rangeDeleteEnd);
const rangeModesStart = rangeSource.indexOf('const RANGE_COMPARISON_TYPE = {');
const rangeModesEnd = rangeSource.indexOf('class RangeImpl', rangeModesStart);
if (rangeModesStart < 0 || rangeModesEnd < rangeModesStart) throw new Error('rustdom build: Range comparison mode constants changed');
rangeSource = rangeSource.slice(0, rangeModesStart) + rangeSource.slice(rangeModesEnd);
const rangeCloneStart = rangeSource.indexOf('  cloneRange() {');
const rangeCloneEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-detach', rangeCloneStart);
if (rangeCloneStart < 0 || rangeCloneEnd < rangeCloneStart) throw new Error('rustdom build: Range clone boundary changed');
rangeSource = rangeSource.slice(0, rangeCloneStart) +
  '  cloneRange() { return Range.createImpl(this._globalObject, [], domSymbolTree.cloneRangeData(this)); }\n\n' +
  rangeSource.slice(rangeCloneEnd);
const rangeBoundaryHelpersStart = rangeSource.indexOf('// https://dom.spec.whatwg.org/#concept-range-bp-set');
const rangeBoundaryHelpersEnd = rangeSource.indexOf('// https://dom.spec.whatwg.org/#contained', rangeBoundaryHelpersStart);
if (rangeBoundaryHelpersStart < 0 || rangeBoundaryHelpersEnd < rangeBoundaryHelpersStart) {
  throw new Error('rustdom build: Range boundary helpers changed');
}
rangeSource = rangeSource.slice(0, rangeBoundaryHelpersStart) +
  'function setBoundaryPointStart(range, node, offset) { domSymbolTree.setRangeBoundary(range, node, offset, "Start", DOMException); }\n' +
  'function setBoundaryPointEnd(range, node, offset) { domSymbolTree.setRangeBoundary(range, node, offset, "End", DOMException); }\n' +
  'function selectNodeWithinRange(node, range) { domSymbolTree.setRangeBoundary(range, node, 0, "SelectNode", DOMException); }\n\n' +
  rangeSource.slice(rangeBoundaryHelpersEnd);
const rangeQueriesStart = rangeSource.indexOf('  isPointInRange(node, offset) {');
const rangeQueriesEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#dom-range-stringifier', rangeQueriesStart);
if (rangeQueriesStart < 0 || rangeQueriesEnd < rangeQueriesStart) throw new Error('rustdom build: Range query boundaries changed');
rangeSource = rangeSource.slice(0, rangeQueriesStart) +
  '  isPointInRange(node, offset) {\n' +
  '    return domSymbolTree.rangePointPosition(this, node, offset, DOMException) === 0;\n  }\n\n' +
  '  comparePoint(node, offset) {\n' +
  '    const result = domSymbolTree.rangePointPosition(this, node, offset, DOMException);\n' +
  '    if (result === null) throw DOMException.create(this._globalObject, [\n' +
  '      "The given Node and the Range are not in the same tree.", "WrongDocumentError"\n' +
  '    ]);\n    return result;\n  }\n\n' +
  '  intersectsNode(node) { return domSymbolTree.rangeIntersectsNode(this, node); }\n\n' + rangeSource.slice(rangeQueriesEnd);
const rangeStringStart = rangeSource.indexOf('  toString() {');
const rangeStringEnd = rangeSource.indexOf('  // https://w3c.github.io/DOM-Parsing/#dom-range-createcontextualfragment', rangeStringStart);
if (rangeStringStart < 0 || rangeStringEnd < rangeStringStart) throw new Error('rustdom build: Range stringification boundary changed');
rangeSource = rangeSource.slice(0, rangeStringStart) +
  '  toString() { return domSymbolTree.rangeText(this); }\n\n' + rangeSource.slice(rangeStringEnd);
/** Both content operations capture the same immutable selection before invoking clone/mutation hooks. */
for (const helper of ['cloneRange', 'extractRange']) {
  const helperStart = rangeSource.indexOf(`function ${helper}(range) {`);
  const selectionStart = rangeSource.indexOf('  let commonAncestor = originalStart.node;', helperStart);
  const doctypeLine = '  const hasDoctypeChildren = containedChildren.some(node => node.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE);';
  const selectionEnd = rangeSource.indexOf(doctypeLine, selectionStart);
  if (helperStart < 0 || selectionStart < helperStart || selectionEnd < selectionStart) {
    throw new Error(`rustdom build: ${helper} content selection changed`);
  }
  rangeSource = rangeSource.slice(0, selectionStart) +
    '  const selection = domSymbolTree.rangeContentSelection(range);\n' +
    '  const firstPartialContainedChild = selection.firstPartial;\n' +
    '  const lastPartiallyContainedChild = selection.lastPartial;\n' +
    '  const containedChildren = selection.contained;\n' +
    '  const hasDoctypeChildren = selection.hasDoctype;' + rangeSource.slice(selectionEnd + doctypeLine.length);
}
const extractHelper = rangeSource.indexOf('function extractRange(range) {');
const extractCollapseStart = rangeSource.indexOf('  let newNode, newOffset;', extractHelper);
const extractCollapseEnd = rangeSource.indexOf('  if (\n    firstPartialContainedChild !== null', extractCollapseStart);
if (extractHelper < 0 || extractCollapseStart < extractHelper || extractCollapseEnd < extractCollapseStart) {
  throw new Error('rustdom build: extractRange collapse geometry changed');
}
rangeSource = rangeSource.slice(0, extractCollapseStart) +
  '  const newNode = selection.collapseNode;\n  const newOffset = selection.collapseOffset;\n\n' + rangeSource.slice(extractCollapseEnd);
const containedHelperStart = rangeSource.indexOf('// https://dom.spec.whatwg.org/#contained');
const containedHelperEnd = rangeSource.indexOf('// https://dom.spec.whatwg.org/#partially-contained', containedHelperStart);
if (containedHelperStart < 0 || containedHelperEnd < containedHelperStart) throw new Error('rustdom build: contained helper changed');
rangeSource = rangeSource.slice(0, containedHelperStart) + rangeSource.slice(containedHelperEnd);
rangeSource = substituteOnce(rangeSource, 'const { compareBoundaryPointsPosition } = require("./boundary-point");\n', '');
const surroundStart = rangeSource.indexOf('  surroundContents(newParent) {');
const surroundWork = rangeSource.indexOf('    const fragment = extractRange(this);', surroundStart);
if (surroundStart < 0 || surroundWork < surroundStart) throw new Error('rustdom build: surroundContents preflight changed');
rangeSource = rangeSource.slice(0, surroundStart) +
  '  surroundContents(newParent) {\n    domSymbolTree.validateRangeSurround(this, newParent, DOMException);\n\n' + rangeSource.slice(surroundWork);
const partialHelperStart = rangeSource.indexOf('// https://dom.spec.whatwg.org/#partially-contained');
const partialHelperEnd = rangeSource.indexOf('// https://dom.spec.whatwg.org/#concept-range-insert', partialHelperStart);
if (partialHelperStart < 0 || partialHelperEnd < partialHelperStart) throw new Error('rustdom build: partial containment helper changed');
rangeSource = rangeSource.slice(0, partialHelperStart) + rangeSource.slice(partialHelperEnd);
const nextHelperStart = rangeSource.indexOf('function nextNodeDescendant(node) {');
const nextHelperEnd = rangeSource.indexOf('function setBoundaryPointStart(range, node, offset)', nextHelperStart);
if (nextHelperStart < 0 || nextHelperEnd < nextHelperStart) throw new Error('rustdom build: Range next-descendant helper changed');
rangeSource = rangeSource.slice(0, nextHelperStart) + rangeSource.slice(nextHelperEnd);
rangeSource = substituteOnce(rangeSource, 'const { nodeRoot, nodeLength, isInclusiveAncestor } = require("../helpers/node");',
  'const { nodeRoot, nodeLength } = require("../helpers/node");');
const insertionStart = rangeSource.indexOf('function insertNodeInRange(node, range) {');
const insertionValidity = rangeSource.indexOf('  parent._preInsertValidity(node, referenceNode);', insertionStart);
if (insertionStart < 0 || insertionValidity < insertionStart) throw new Error('rustdom build: Range insertion preflight changed');
rangeSource = rangeSource.slice(0, insertionStart) +
  'function insertNodeInRange(node, range) {\n' +
  '  const plan = domSymbolTree.rangeInsertionPlan(range, node, DOMException);\n' +
  '  const startNode = plan.startNode;\n  const startOffset = plan.startOffset;\n' +
  '  const parent = plan.parent;\n  let referenceNode = plan.reference;\n\n' + rangeSource.slice(insertionValidity);
rangeSource = substituteOnce(rangeSource, '  if (startNode.nodeType === NODE_TYPE.TEXT_NODE) {\n    referenceNode = startNode.splitText(startOffset);',
  '  if (plan.splitText) {\n    referenceNode = startNode.splitText(startOffset);');
rangeSource = substituteOnce(rangeSource,
  '  let newOffset = !referenceNode ? nodeLength(parent) : domSymbolTree.index(referenceNode);\n' +
  '  newOffset += node.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE ? nodeLength(node) : 1;',
  '  const newOffset = domSymbolTree.rangeInsertionOffset(node, parent, referenceNode);');
const fragmentContextStart = rangeSource.indexOf('  createContextualFragment(fragment) {');
const fragmentContextEnd = rangeSource.indexOf('  // https://dom.spec.whatwg.org/#concept-range-root', fragmentContextStart);
if (fragmentContextStart < 0 || fragmentContextEnd < fragmentContextStart) throw new Error('rustdom build: Range fragment context boundary changed');
rangeSource = rangeSource.slice(0, fragmentContextStart) +
  '  createContextualFragment(fragment) {\n' +
  '    let element = domSymbolTree.rangeFragmentContext(this);\n' +
  '    if (element === null) element = createElement(this._rangeStartNode._ownerDocument, "body", HTML_NS);\n' +
  '    return parseFragment(fragment, element);\n  }\n\n' + rangeSource.slice(fragmentContextEnd);
const cloneDriverStart = rangeSource.indexOf('function cloneRange(range) {');
const cloneDriverEnd = rangeSource.indexOf('// https://dom.spec.whatwg.org/#concept-range-extract', cloneDriverStart);
if (cloneDriverStart < 0 || cloneDriverEnd < cloneDriverStart) throw new Error('rustdom build: cloneContents driver boundary changed');
rangeSource = rangeSource.slice(0, cloneDriverStart) +
  'function cloneRange(range) {\n' +
  '  return domSymbolTree.cloneRangeContents(range, DocumentFragment, clone, DOMException);\n}\n\n' + rangeSource.slice(cloneDriverEnd);
const extractDriverStart = rangeSource.indexOf('function extractRange(range) {');
const extractDriverEnd = rangeSource.indexOf('module.exports = {', extractDriverStart);
if (extractDriverStart < 0 || extractDriverEnd < extractDriverStart) throw new Error('rustdom build: extractContents driver boundary changed');
rangeSource = rangeSource.slice(0, extractDriverStart) +
  'function extractRange(range) {\n' +
  '  return domSymbolTree.extractRangeContents(range, DocumentFragment, clone, DOMException);\n}\n\n' + rangeSource.slice(extractDriverEnd);
rangeSource = substituteOnce(rangeSource, 'const { nodeRoot, nodeLength } = require("../helpers/node");',
  'const { nodeRoot } = require("../helpers/node");');
await writeFile(rangePath, rangeSource);
/** Share native topology helpers with every original DOM caller. */
const geometryHelpersPath = resolve(destination, 'lib/jsdom/living/helpers/node.js');
const geometryHelpersSource = await readFile(geometryHelpersPath, 'utf8');
if (!['function nodeLength(node)', 'function nodeRoot(node)', 'function isInclusiveAncestor(ancestorNode, node)',
  'function isFollowing(nodeA, nodeB)'].every((anchor) => geometryHelpersSource.includes(anchor))) {
  throw new Error('rustdom build: generic node geometry helper boundaries changed');
}
await writeFile(geometryHelpersPath, '"use strict";\n' +
  'const { domSymbolTree } = require("./internal-constants");\n' +
  'module.exports = {\n' +
  '  nodeLength(node) { return domSymbolTree.nodeLength(node); },\n' +
  '  nodeRoot(node) { return domSymbolTree.nodeRoot(node); },\n' +
  '  isInclusiveAncestor(ancestor, node) { return domSymbolTree.isInclusiveAncestor(ancestor, node); },\n' +
  '  isFollowing(node, reference) { return domSymbolTree.isFollowing(node, reference); }\n};\n');
/** All fragment host assignments, including parse5 template replacement, share native registration. */
const fragmentImplementationPath = resolve(destination, 'lib/jsdom/living/nodes/DocumentFragment-impl.js');
let fragmentImplementation = await readFile(fragmentImplementationPath, 'utf8');
fragmentImplementation = substituteOnce(fragmentImplementation, '  // This is implemented separately for Document',
  '  get _host() { return domSymbolTree.rootHost(this); }\n' +
  '  set _host(host) { domSymbolTree.setRootHost(this, host, "host" in this); }\n\n' +
  '  // This is implemented separately for Document');
await writeFile(fragmentImplementationPath, fragmentImplementation);
/** Preserve helper input guards while native traversal distinguishes shadow and template hosts. */
const shadowHelpersPath = resolve(destination, 'lib/jsdom/living/helpers/shadow-dom.js');
let shadowHelpers = await readFile(shadowHelpersPath, 'utf8');
shadowHelpers = substituteOnce(shadowHelpers,
  'function shadowIncludingRoot(node) {\n  const root = nodeRoot(node);\n  return isShadowRoot(root) ? shadowIncludingRoot(root.host) : root;\n}',
  'function shadowIncludingRoot(node) { return domSymbolTree.shadowIncludingRoot(node); }');
const shadowAncestorStart = shadowHelpers.indexOf('function isShadowInclusiveAncestor(ancestor, node) {');
const shadowAncestorEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#retarget', shadowAncestorStart);
if (shadowAncestorStart < 0 || shadowAncestorEnd < shadowAncestorStart) throw new Error('rustdom build: shadow ancestor helper boundary changed');
shadowHelpers = shadowHelpers.slice(0, shadowAncestorStart) +
  'function isShadowInclusiveAncestor(ancestor, node) {\n' +
  '  if (!isNode(node)) return false;\n' +
  '  if (!ancestor || (typeof ancestor !== "object" && typeof ancestor !== "function") || !("nodeType" in ancestor)) return false;\n' +
  '  return domSymbolTree.isShadowInclusiveAncestor(ancestor, node);\n}\n\n' + shadowHelpers.slice(shadowAncestorEnd);
const retargetStart = shadowHelpers.indexOf('function retarget(a, b) {');
const retargetEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#get-the-parent', retargetStart);
if (retargetStart < 0 || retargetEnd < retargetStart) throw new Error('rustdom build: retarget helper boundary changed');
shadowHelpers = shadowHelpers.slice(0, retargetStart) +
  'function retarget(a, b) {\n' +
  '  if (!isNode(a)) return a;\n' +
  '  if (!isShadowRoot(nodeRoot(a))) return a;\n' +
  '  return domSymbolTree.retarget(a, isNode(b) ? b : null);\n}\n\n' + shadowHelpers.slice(retargetEnd);
const findSlotStart = shadowHelpers.indexOf('function findSlot(slotable, openFlag) {');
const findSlotEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#signal-a-slot-change', findSlotStart);
if (findSlotStart < 0 || findSlotEnd < findSlotStart) throw new Error('rustdom build: findSlot helper boundary changed');
shadowHelpers = shadowHelpers.slice(0, findSlotStart) +
  'function findSlot(slotable, openFlag) {\n' +
  '  const { parentNode: parent } = slotable;\n' +
  '  if (!parent) return null;\n' +
  '  const shadow = parent._shadowRoot;\n' +
  '  if (!shadow || (openFlag && shadow.mode !== "open")) return null;\n' +
  '  return domSymbolTree.findSlot(shadow, slotable);\n}\n\n' + shadowHelpers.slice(findSlotEnd);
const findSlotablesStart = shadowHelpers.indexOf('function findSlotable(slot) {');
const findSlotablesEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#find-flattened-slotables', findSlotablesStart);
if (findSlotablesStart < 0 || findSlotablesEnd < findSlotablesStart) throw new Error('rustdom build: findSlotable helper boundary changed');
shadowHelpers = shadowHelpers.slice(0, findSlotablesStart) +
  'function findSlotable(slot) {\n  return domSymbolTree.findSlotables(slot);\n}\n\n' + shadowHelpers.slice(findSlotablesEnd);
const flattenSlotsStart = shadowHelpers.indexOf('function findFlattenedSlotables(slot) {');
const flattenSlotsEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#find-a-slot', flattenSlotsStart);
if (flattenSlotsStart < 0 || flattenSlotsEnd < flattenSlotsStart) throw new Error('rustdom build: flattened-slot helper boundary changed');
shadowHelpers = shadowHelpers.slice(0, flattenSlotsStart) +
  'function findFlattenedSlotables(slot) {\n  return domSymbolTree.findFlattenedSlotables(slot);\n}\n\n' + shadowHelpers.slice(flattenSlotsEnd);
const assignmentStart = shadowHelpers.indexOf('function assignSlotable(slot) {');
const assignmentEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#assign-slotables-for-a-tree', assignmentStart);
if (assignmentStart < 0 || assignmentEnd < assignmentStart) throw new Error('rustdom build: slot assignment boundary changed');
shadowHelpers = shadowHelpers.slice(0, assignmentStart) +
  'function assignSlotable(slot) {\n  domSymbolTree.runSlotAssignments(slot, false, signalSlotChange);\n}\n\n' + shadowHelpers.slice(assignmentEnd);
const treeAssignmentStart = shadowHelpers.indexOf('function assignSlotableForTree(root) {');
const treeAssignmentEnd = shadowHelpers.indexOf('// https://dom.spec.whatwg.org/#find-slotables', treeAssignmentStart);
if (treeAssignmentStart < 0 || treeAssignmentEnd < treeAssignmentStart) throw new Error('rustdom build: tree assignment boundary changed');
shadowHelpers = shadowHelpers.slice(0, treeAssignmentStart) +
  'function assignSlotableForTree(root) {\n  domSymbolTree.runSlotAssignments(root, true, signalSlotChange);\n}\n\n' + shadowHelpers.slice(treeAssignmentEnd);
/** Keep microtask scheduling and callback delivery in their original positions around the native batch. */
const signalSlotChangeSource = 'function signalSlotChange(slot) {\n  if (!signalSlotList.some(entry => entry === slot)) {\n    signalSlotList.push(slot);\n  }\n\n  queueMutationObserverMicrotask();\n}';
shadowHelpers = substituteOnce(shadowHelpers, signalSlotChangeSource,
  'function signalSlotChange(slot) {\n  domSymbolTree.queueSlotSignal(slot);\n  queueMutationObserverMicrotask();\n}');
shadowHelpers = substituteOnce(shadowHelpers, 'const { signalSlotList, queueMutationObserverMicrotask }',
  'const { queueMutationObserverMicrotask }');
await writeFile(shadowHelpersPath, shadowHelpers);
const mutationObserversPath = resolve(destination, 'lib/jsdom/living/helpers/mutation-observers.js');
let mutationObserversSource = await readFile(mutationObserversPath, 'utf8');
mutationObserversSource = substituteOnce(mutationObserversSource, 'let mutationObserverMicrotaskQueueFlag = false;', '');
mutationObserversSource = substituteOnce(mutationObserversSource, 'const activeMutationObservers = new Set();', '');
mutationObserversSource = substituteOnce(mutationObserversSource, '    activeMutationObservers.add(observer);\n', '');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '  if (mutationObserverMicrotaskQueueFlag) {\n    return;\n  }\n\n  mutationObserverMicrotaskQueueFlag = true;',
  '  if (!domSymbolTree.requestMutationObserverMicrotask()) {\n    return;\n  }');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '  mutationObserverMicrotaskQueueFlag = false;\n\n  const notifyList = [...activeMutationObservers].sort((a, b) => a._id - b._id);\n  activeMutationObservers.clear();',
  '  const notifyList = domSymbolTree.beginMutationObserverNotification();');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '    observer._recordQueue.push(record);', '    domSymbolTree.enqueueMutationRecord(observer, record);');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '    const records = [...mo._recordQueue];\n    mo._recordQueue = [];',
  '    const records = domSymbolTree.takeMutationRecords(mo);');
const observerSelectionStart = mutationObserversSource.indexOf('  const interestedObservers = new Map();');
const observerSelectionEnd = mutationObserversSource.indexOf('  for (const [observer, mappedOldValue] of interestedObservers.entries()) {', observerSelectionStart);
if (observerSelectionStart < 0 || observerSelectionEnd < observerSelectionStart) throw new Error('rustdom build: missing mutation observer selection boundary');
mutationObserversSource = substituteOnce(mutationObserversSource,
  mutationObserversSource.slice(observerSelectionStart, observerSelectionEnd),
  '  const interestedObservers = domSymbolTree.interestedMutationObservers(type, target, name, namespace, oldValue);\n\n');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '  for (const [observer, mappedOldValue] of interestedObservers.entries()) {',
  '  for (const { observer, oldValue: mappedOldValue } of interestedObservers) {');
const mutationProductionStart = mutationObserversSource.indexOf('  const interestedObservers = domSymbolTree.interestedMutationObservers(');
const mutationProductionEnd = mutationObserversSource.indexOf('  queueMutationObserverMicrotask();', mutationProductionStart);
if (mutationProductionStart < 0 || mutationProductionEnd < mutationProductionStart) throw new Error('rustdom build: missing mutation record production boundary');
mutationObserversSource = substituteOnce(mutationObserversSource,
  mutationObserversSource.slice(mutationProductionStart, mutationProductionEnd),
  '  domSymbolTree.produceMutationRecords({ type, target, attributeName: name, attributeNamespace: namespace, oldValue,\n' +
  '    addedNodes, removedNodes, previousSibling, nextSibling },\n' +
  '  (nativeRecord, owners) => MutationRecord.createImpl(target._globalObject, [], { nativeRecord, owners }));\n\n');
mutationObserversSource = substituteOnce(mutationObserversSource,
  '    for (const node of mo._nodeList) {\n      node._registeredObserverList = node._registeredObserverList.filter(registeredObserver => {\n        return registeredObserver.source !== mo;\n      });\n    }\n\n', '');
mutationObserversSource = substituteOnce(mutationObserversSource, '// https://dom.spec.whatwg.org/#signal-slot-list\nconst signalSlotList = [];\n\n', '');
mutationObserversSource = substituteOnce(mutationObserversSource, '  const signalList = [...signalSlotList];\n  signalSlotList.splice(0, signalSlotList.length);',
  '  const signalList = domSymbolTree.takeSlotSignals();');
mutationObserversSource = substituteOnce(mutationObserversSource, '  queueMutationObserverMicrotask,\n\n  signalSlotList', '  queueMutationObserverMicrotask');
const observerDeliveryStart = mutationObserversSource.indexOf('function notifyMutationObservers() {');
const observerDeliveryEnd = mutationObserversSource.indexOf('\n}\n\nmodule.exports = {', observerDeliveryStart);
if (observerDeliveryStart < 0 || observerDeliveryEnd < observerDeliveryStart) throw new Error('rustdom build: missing mutation observer delivery boundary');
mutationObserversSource = substituteOnce(mutationObserversSource,
  mutationObserversSource.slice(observerDeliveryStart, observerDeliveryEnd + 2),
  'function notifyMutationObservers() {\n' +
  '  domSymbolTree.runObserverDelivery((mo, records) => {\n' +
  '    try {\n' +
  '      const moWrapper = idlUtils.wrapperForImpl(mo);\n' +
  '      mo._callback.call(moWrapper, records.map(idlUtils.wrapperForImpl), moWrapper);\n' +
  '    } catch (error) {\n' +
  '      const { target } = records[0];\n' +
  '      reportException(target._ownerDocument._defaultView, error);\n' +
  '    }\n' +
  '  }, (slot) => {\n' +
  '    const event = Event.createImpl(slot._globalObject, ["slotchange", { bubbles: true }], { isTrusted: true });\n' +
  '    slot._dispatch(event);\n' +
  '  });\n' +
  '}');
await writeFile(mutationObserversPath, mutationObserversSource);
const htmlSlotPath = resolve(destination, 'lib/jsdom/living/nodes/HTMLSlotElement-impl.js');
let htmlSlotSource = await readFile(htmlSlotPath, 'utf8');
htmlSlotSource = substituteOnce(htmlSlotSource, '"use strict";', '"use strict";\nconst { domSymbolTree } = require("../helpers/internal-constants");');
htmlSlotSource = substituteOnce(htmlSlotSource, '    this._assignedNodes = [];', '    domSymbolTree.initializeSlotAssignment(this);');
htmlSlotSource = substituteOnce(htmlSlotSource, 'this._assignedNodes.map(idlUtils.wrapperForImpl)', 'domSymbolTree.cachedSlotables(this).map(idlUtils.wrapperForImpl)');
await writeFile(htmlSlotPath, htmlSlotSource);
/** Keep constructor defaults allocation-free; actual name writes occur after node initialization. */
const slotablePath = resolve(destination, 'lib/jsdom/living/nodes/Slotable-impl.js');
let slotableSource = await readFile(slotablePath, 'utf8');
const slotableInitialization = '  _initSlotableMixin() {\n    this._slotableName = "";\n  }';
if (!slotableSource.includes(slotableInitialization)) throw new Error('rustdom build: slotable initialization changed');
slotableSource = slotableSource.replace('"use strict";', '"use strict";\nconst { domSymbolTree } = require("../helpers/internal-constants");')
  .replace(slotableInitialization, '  _initSlotableMixin() {}\n' +
    '  get _slotableName() { return domSymbolTree.slotableName(this); }\n' +
    '  set _slotableName(value) { domSymbolTree.setSlotableName(this, value); }');
await writeFile(slotablePath, slotableSource);
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
let serializationSource = substituteOnce(await readFile(serializationPath, 'utf8'),
  '    return outer ? parse5.serializeOuter(node, config) : parse5.serialize(node, config);',
  '    return domSymbolTree.serializeHTML(node, Boolean(outer), config.scriptingEnabled !== false);');
serializationSource = replaceRegion(serializationSource, '    let serialized = "";', '  } catch (e) {',
  '    return produceXMLSerialization.serializeForest(childNodes.map(child => utils.wrapperForImpl(child)), requireWellFormed);\n', substituteOnce);
await writeFile(serializationPath, serializationSource);

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
