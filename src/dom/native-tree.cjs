/** @module rustdom/native-tree Keeps Rust topology authoritative and JS ownership edges visible to V8 GC. */
'use strict';
const SymbolTree = require('symbol-tree');
const { NativeTree, QueryMode, AttributeField } = require('../../dist/native.cjs');
const { writeNodeData, writeAttribute } = require('./data-bridge.cjs');

/**
 * Execute topology changes in Rust, then replay them into V8-visible ownership edges.
 * @extends SymbolTree
 */
class NativeSymbolTree extends SymbolTree {
  /** @param {string} [description] - Debug description for the per-node ownership symbol. */
  constructor(description) {
    super(description);
    this._arena = new NativeTree();
    this._arena.setUnicodeVersion(process.versions.unicode);
    this._handleBatchSize = this._arena.handleBatchSize;
    this._objects = new Map();
    this._nextHandle = 0;
    this._handleLimit = 0;
    const arena = this._arena;
    const objects = this._objects;
    this._collected = new FinalizationRegistry((id) => {
      objects.delete(id);
      arena.release(id);
    });
  }

  /**
   * Read GC-visible edges without a native call on the hot traversal path.
   * @param {object|null} object - DOM node or a related null pointer.
   * @returns {object|null} Its cached ownership edges, never a separate public DOM wrapper.
   */
  _node(object) {
    if (!object) return null;
    return object[this.symbol] || super._node(object);
  }

  /**
   * Index only nodes that participate in topology or a native traversal.
   * @param {object} object - Real node entering native storage.
   * @returns {number} Its stable native handle.
   */
  _identify(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) {
      if (this._nextHandle === this._handleLimit) {
        this._nextHandle = this._arena.reserveHandles();
        this._handleLimit = this._nextHandle + this._handleBatchSize;
      }
      record.nativeId = this._nextHandle++;
      record.nativeChildCount = 0;
      this._objects.set(record.nativeId, new WeakRef(object));
      this._collected.register(object, record.nativeId);
    }
    return record.nativeId;
  }

  /** @param {object} object - DOM node. @returns {number} A handle with initialized native metadata. */
  _ensure(object) {
    const id = this._identify(object);
    const record = this._node(object);
    if (!record.nativeDataReady) {
      writeNodeData(this._arena, record.nativeId, object, (node) => this._ensure(node));
      record.nativeDataReady = true;
    }
    return id;
  }

  /** @param {object} object - Mutated DOM implementation. @returns {void} Updates an indexed node's native data. */
  updateNodeData(object) {
    const record = this._node(object);
    if (record.nativeCharacterKind !== undefined || record.nativeAttribute) return;
    if (record.nativeId !== undefined) {
      writeNodeData(this._arena, record.nativeId, object, (node) => this._ensure(node));
      record.nativeDataReady = true;
    }
  }

  /** @param {object} node - CharacterData implementation. @param {number} kind - Final subclass kind. @param {string} value - Initial UTF-16 value. @returns {void} */
  initializeCharacterData(node, kind, value) {
    const id = this._identify(node);
    this._arena.setCharacterData(id, kind, value);
    const record = this._node(node);
    record.nativeCharacterKind = kind;
    record.nativeDataReady = true;
  }

  /** @param {object} node - CharacterData implementation. @returns {string} Its current native value. */
  characterData(node) { return this._arena.getCharacterData(this._identify(node)); }
  /** @param {object} node - CharacterData implementation. @param {string} value - Replacement value. @returns {void} */
  setCharacterData(node, value) { this._arena.setCharacterData(this._identify(node), this._node(node).nativeCharacterKind, value); }
  /** @param {object} node - CharacterData implementation. @returns {number} UTF-16 length without transferring text. */
  characterLength(node) { return this._arena.characterLength(this._identify(node)); }
  /** @param {object} node - CharacterData implementation. @param {number} offset - UTF-16 offset. @param {number} count - Requested units. @returns {string} Native slice. */
  substringData(node, offset, count) { return this._arena.substringData(this._identify(node), offset, count); }
  /** @param {object} node - CharacterData implementation. @param {number} offset - UTF-16 offset. @param {number} count - Units to replace. @param {string} value - New units. @returns {string} Previous value for observers. */
  replaceCharacterData(node, offset, count, value) { return this._arena.replaceCharacterData(this._identify(node), offset, count, value); }
  /** @param {object} node - Text or CDATA implementation. @returns {string} Adjacent text from the native tree. */
  wholeText(node) { return this._arena.wholeText(this._identify(node)); }

  /** @param {object} node - Attr implementation. @param {number} kind - Attr type. @param {object} data - Initial metadata. @returns {void} */
  initializeAttribute(node, kind, data) {
    const id = this._identify(node);
    writeAttribute(this._arena, id, kind, data);
    const record = this._node(node);
    record.nativeAttribute = true;
    record.nativeDataReady = true;
  }
  /** @param {object} node - Attr. @returns {string} Native local name. */
  attributeName(node) { return this._arena.attributeField(this._identify(node), AttributeField.Name); }
  /** @param {object} node - Attr. @returns {string|null} Native namespace. */
  attributeNamespace(node) { return this._arena.attributeField(this._identify(node), AttributeField.Namespace); }
  /** @param {object} node - Attr. @returns {string|null} Native prefix. */
  attributePrefix(node) { return this._arena.attributeField(this._identify(node), AttributeField.Prefix); }
  /** @param {object} node - Attr. @returns {string} Native value. */
  attributeValue(node) { return this._arena.attributeField(this._identify(node), AttributeField.Value); }
  /** @param {object} node - Attr. @returns {string} Qualified name constructed in Rust. */
  attributeQualifiedName(node) { return this._arena.attributeField(this._identify(node), AttributeField.QualifiedName); }
  /** @param {object} node - Attr. @param {string} value - New value. @returns {void} */
  setAttributeValue(node, value) { this._arena.setAttributeValue(this._identify(node), value); }

  /** @param {object} element - Constructing element. @returns {void} Initializes native order and host GC roots. */
  initializeAttributeCollection(element) {
    this._arena.initializeAttributeCollection(this._identify(element));
    this._node(element).attributeRoots = new Map();
  }
  /** @param {object} element - Element. @returns {object[]} Ordered view of canonical native IDs. */
  attributeList(element) { return this._arena.attributeIds(this._identify(element)).map((id) => this._object(id)); }
  /** @param {object} element - Element. @returns {IterableIterator<number>} Native ordered positions without materializing Attr wrappers. */
  attributeIndices(element) { return this._arena.attributeIds(this._identify(element)).keys(); }
  /** @param {object} element - Element. @returns {number} Native collection size. */
  attributeCount(element) { return this._arena.attributeCount(this._identify(element)); }
  /** @param {object} element - Element. @param {number} index - Position. @returns {object|null} Attr identity. */
  attributeAt(element, index) { return this._object(this._arena.attributeAt(this._identify(element), index)); }
  /** @param {object} attribute - Attr. @returns {object|null} Canonical owner. */
  attributeOwner(attribute) { return this._object(this._arena.attributeOwner(this._identify(attribute))); }
  /** @param {object} attribute - Attr. @param {object|null} element - Constructor owner. @returns {void} */
  initializeAttributeOwner(attribute, element) {
    if (element) this._arena.initializeAttributeOwner(this._identify(attribute), this._ensure(element));
    this._node(attribute).attributeOwnerRoot = element;
  }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {boolean} Native membership. */
  containsAttribute(element, attribute) { return this._arena.containsAttribute(this._identify(element), this._identify(attribute)); }
  /** @param {object} element - Element. @param {string} name - Qualified name. @param {boolean} [normalize] - HTML ASCII normalization. @returns {object|null} Attr from native name cache. */
  attributeByName(element, name, normalize = true) {
    return this._object(this._arena.attributeByName(this._ensure(element), name,
      normalize && element._ownerDocument._parsingMode === 'html'));
  }
  /** @param {object} element - Element. @param {string|null} namespace - Namespace. @param {string} name - Local name. @returns {object|null} Native namespace lookup. */
  attributeByNamespace(element, namespace, name) {
    return this._object(this._arena.attributeByNamespace(this._ensure(element), namespace, name));
  }
  /** @param {object} element - Element. @param {boolean} [supported] - NamedNodeMap supported-property filtering. @returns {string[]} Native ordered names. */
  attributeNames(element, supported = false) {
    return this._arena.attributeNames(this._ensure(element), supported, element._ownerDocument._parsingMode === 'html');
  }
  /**
   * Apply only GC-visible ownership edges after native commit. Native code owns order and cache decisions.
   * @param {object} element - Owner element.
   * @param {object} delta - Native reference changes.
   * @returns {object} Change record retaining the previous Attr for the caller.
   */
  _applyAttributeDelta(element, delta) {
    const previous = this._object(delta.previous);
    const roots = this._node(element).attributeRoots;
    if (delta.detached) this._node(this._object(delta.detached)).attributeOwnerRoot = null;
    if (delta.attached) {
      const attribute = this._object(delta.attached);
      roots.set(delta.attached, attribute);
      this._node(attribute).attributeOwnerRoot = element;
    }
    for (const id of delta.released) roots.delete(id);
    return { changed: delta.changed, previous };
  }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native append effects. */
  appendAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.appendAttribute(this._ensure(element), this._identify(attribute))); }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native removal effects. */
  removeAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.removeAttribute(this._ensure(element), this._identify(attribute))); }
  /** @param {object} element - Element. @param {object} oldAttribute - Prior Attr. @param {object} newAttribute - Replacement. @returns {object} Native replacement effects. */
  replaceAttribute(element, oldAttribute, newAttribute) { return this._applyAttributeDelta(element, this._arena.replaceAttribute(this._ensure(element), this._identify(oldAttribute), this._identify(newAttribute))); }
  /** @param {object} element - Element. @param {object} attribute - Attr. @returns {object} Native append/replace/no-op decision. */
  setAttribute(element, attribute) { return this._applyAttributeDelta(element, this._arena.setAttribute(this._ensure(element), this._identify(attribute))); }

  /** @param {object} node - DOM root. @param {boolean} outer - Include root markup. @param {boolean} scripting - Noscript serialization mode. @returns {string} HTML from native data. */
  serializeHTML(node, outer, scripting) { return this._arena.serializeHtml(this._ensure(node), outer, scripting); }

  /**
   * Resolve native query results to the same DOM implementations used by jsdom.
   * @param {string} selector - Already-converted DOMString selector.
   * @param {object} root - Query context.
   * @param {number} mode - Native query mode.
   * @returns {object[]|null} Results or null for compatibility handling.
   */
  _query(selector, root, mode) {
    const document = root._ownerDocument;
    if (document?._parsingMode !== 'html' || typeof selector !== 'string' || !selector.isWellFormed()) return null;
    let treeRoot = root;
    while (this.parent(treeRoot)) treeRoot = this.parent(treeRoot);
    if (treeRoot._host?._shadowRoot === treeRoot) return null;
    const result = this._arena.query(selector, this._ensure(root), this._ensure(document), mode, document._mode === 'quirks');
    return result == null ? null : Array.from(result, (id) => this._object(id));
  }
  /** @param {string} selector - Selector. @param {object} root - Context. @returns {object[]|null} Descendants or fallback. */
  queryAll(selector, root) { return this._query(selector, root, QueryMode.All); }
  /** @param {string} selector - Selector. @param {object} root - Context. @returns {object[]|null} First match or fallback. */
  queryFirst(selector, root) { return this._query(selector, root, QueryMode.First); }
  /** @param {string} selector - Selector. @param {object} root - Subject. @returns {object[]|null} Subject match or fallback. */
  matchNode(selector, root) { return this._query(selector, root, QueryMode.Matches); }
  /** @param {string} selector - Selector. @param {object} root - Original subject. @returns {object[]|null} Closest ancestor or fallback. */
  closestNode(selector, root) { return this._query(selector, root, QueryMode.Closest); }

  /** @param {number} id - Native handle or zero. @returns {object|null} The original JS node. */
  _object(id) {
    if (!id) return null;
    const object = this._objects.get(id)?.deref();
    if (!object) throw new Error(`NativeSymbolTree: reachable node ${id} was collected`);
    return object;
  }

  /** @param {object} object - Node to detach. @returns {object} The same node instance. */
  remove(object) {
    const record = this._node(object);
    if (record.nativeId === undefined) return super.remove(object);
    const parent = this._node(record.parent);
    const count = this._arena.remove(record.nativeId);
    super.remove(object);
    if (parent) parent.nativeChildCount = count;
    return object;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  appendChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.append(this._ensure(parent), this._ensure(child));
    // Call non-dispatching base operations to avoid applying the native write twice.
    if (record.lastChild) super.insertAfter(record.lastChild, child);
    else super.appendChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} parent - Parent node. @param {object} child - Detached child. @returns {object} The inserted child. */
  prependChild(parent, child) {
    const record = this._node(parent);
    const count = this._arena.prepend(this._ensure(parent), this._ensure(child));
    if (record.firstChild) super.insertBefore(record.firstChild, child);
    else super.prependChild(parent, child);
    record.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Following sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertBefore(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertBefore(this._ensure(reference), this._ensure(child));
    super.insertBefore(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} reference - Preceding sibling. @param {object} child - Detached node. @returns {object} The inserted node. */
  insertAfter(reference, child) {
    const referenceNode = this._node(reference);
    const parent = this._node(referenceNode.parent);
    const count = this._arena.insertAfter(this._ensure(reference), this._ensure(child));
    super.insertAfter(reference, child);
    if (parent) parent.nativeChildCount = count;
    return child;
  }

  /** @param {object} object - Parent node. @returns {number} The native-maintained child count. */
  childrenCount(object) { return this._node(object).nativeChildCount || 0; }

  /**
   * Batch pure traversals in Rust; preserve live callback semantics when a filter is supplied.
   * @param {object} object - Inclusive subtree root.
   * @param {object} [options] - Existing SymbolTree array/filter/thisArg options.
   * @returns {object[]} Original nodes in document order.
   */
  treeToArray(object, options) {
    if (options?.filter) return super.treeToArray(object, options);
    const array = options?.array || [];
    if (object) for (const id of this._arena.descendants(this._ensure(object))) array.push(this._object(id));
    return array;
  }

  /** @returns {object} Allocation and operation counters without strong references to nodes. */
  statistics() {
    return { ...this._arena.statistics(), indexedNodes: this._objects.size, handleBatchSize: this._handleBatchSize };
  }
}

module.exports = NativeSymbolTree;
