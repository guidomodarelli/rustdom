/** @file GC-visible File ownership and realm adapters around the native ordered FormData list. */
'use strict';
const { NativeFormDataEntries, prepareFormDataValue, constructFormData } = require('../../dist/native.cjs');

/** @param {object} context - Existing WebIDL/factory primitives and the form-construction driver. @returns {Function} Private FormData implementation. */
function createFormDataImplementation(context) {
  const { DOMException, idlUtils } = context;
  /** Keep private storage independent of later host constructor replacements. */
  const EntryMap = Map;
  /** Preserve weak ownership of serializer projections without consulting mutable globals. */
  const ViewIdMap = WeakMap;
  /** Preserve duplicate-removal bookkeeping after a serializer has captured a view. */
  const RemovedIdSet = Set;
  /** Project native identities using the captured Array factory and constructor. */
  const arrayFrom = Array.from.bind(Array);
  /** Read private entries without consulting mutable host prototypes. */
  const getEntry = Function.prototype.call.bind(EntryMap.prototype.get);
  /** Store visible File owners through the captured intrinsic. */
  const setEntry = Function.prototype.call.bind(EntryMap.prototype.set);
  /** Release removed owners even when a host prototype is replaced. */
  const deleteEntry = Function.prototype.call.bind(EntryMap.prototype.delete);
  /** Read serializer identities without invoking foreign prototype getters. */
  const getViewId = Function.prototype.call.bind(ViewIdMap.prototype.get);
  /** Associate weak serializer keys through the captured intrinsic. */
  const setViewId = Function.prototype.call.bind(ViewIdMap.prototype.set);
  /** Build temporary membership sets without the mutable constructor adder lookup. */
  const addRemovedId = Function.prototype.call.bind(RemovedIdSet.prototype.add);
  /** Check temporary native identities through the captured intrinsic. */
  const hasRemovedId = Function.prototype.call.bind(RemovedIdSet.prototype.has);
  /** @param {number[]} identities - Removed native entry identities. @returns {Set<number>} Temporary membership index. */
  function createRemovedIds(identities) {
    const removed = new RemovedIdSet();
    for (const id of identities) addRemovedId(removed, id);
    return removed;
  }
  const helpers = { ...context,
    /** Capture the intrinsic iteration key during runtime initialization, before consumers replace host globals. */
    iteratorSymbol: Symbol.iterator,
    /** @param {string} message - Explicit upstream constructor diagnostic. @returns {never} Original host error realm; iterator errors use engine intrinsics. */
    throwTypeError(message) { throw new TypeError(message); },
    /** @param {object} globalObject - FormData realm. @param {string} message - Native diagnostic. @returns {never} Realm DOMException. */
    throwNotFound(globalObject, message) { throw DOMException.create(globalObject, [message, 'NotFoundError']); },
  };
  /** @param {string} name - Converted name. @param {*} value - Converted value. @param {string} [filename] - Converted filename. @returns {object} GC-visible prepared entry. */
  function createAnEntry(name, value, filename) {
    // WebIDL has already selected the string overload; only Blob/File values need a realm factory.
    if (typeof value === 'string') return { name, value };
    let prepared;
    prepareFormDataValue(value, filename, helpers, (result) => { prepared = result; });
    return { name, value: prepared };
  }
  return class FormDataImpl {
    /** @param {object} globalObject - Actual realm. @param {unknown[]} args - Converted constructor arguments. */
    constructor(globalObject, args) {
      this._globalObject = globalObject; this._nativeEntries = new NativeFormDataEntries();
      this._entryValues = new EntryMap(); this._view = null; this._viewIds = new ViewIdMap();
      if (args[0] !== undefined) {
        const [form, submitter = null] = args;
        constructFormData(form, submitter, globalObject, helpers, (name, value) => { this._appendEntry({ name, value }); });
      }
    }
    /** @param {number} id - Native slot identity. @returns {object} Immutable JS projection, including GC-visible File ownership. */
    _entry(id) {
      const entry = getEntry(this._entryValues, id);
      if (!entry) throw new Error(`FormData: value projection missing for entry ${id}`);
      return entry;
    }
    /** @param {object} entry - Existing entry factory result. @returns {number} Native entry identity. */
    _appendEntry(entry) {
      const file = typeof entry.value !== 'string';
      const id = this._nativeEntries.append(entry.name, file ? null : entry.value);
      if (id === null) throw new RangeError('FormData append: entry identities exhausted');
      setEntry(this._entryValues, id, entry);
      if (this._view !== null) { this._view.push(entry); setViewId(this._viewIds, entry, id); }
      return id;
    }
    /** @returns {object[]} Materialize the current serializer view while retaining original array mutation behavior. */
    get _entries() {
      if (this._view === null) this._view = arrayFrom(this._nativeEntries.allIds(), (id) => {
        const entry = this._entry(id); setViewId(this._viewIds, entry, id); return entry;
      });
      return this._view;
    }
    /** @param {number} index - Current public iterator index. @returns {Array|null} One live entry, without rebuilding the complete list. */
    _entryAt(index) {
      const id = this._nativeEntries.idAt(index);
      if (id === null) return null;
      const entry = this._entry(id); return [entry.name, idlUtils.tryWrapperForImpl(entry.value)];
    }
    /** @param {string} name - Converted name. @param {*} value - Converted value. @param {string} [filename] - Converted filename. @returns {void} */
    append(name, value, filename) { this._appendEntry(createAnEntry(name, value, filename)); }
    /** @param {string} name - Converted name. @returns {void} Remove native matches and release their visible File owners. */
    delete(name) {
      const removed = this._nativeEntries.delete(name);
      for (const id of removed) deleteEntry(this._entryValues, id);
      if (this._view !== null) { const ids = createRemovedIds(removed); this._view = this._view.filter((entry) => !hasRemovedId(ids, getViewId(this._viewIds, entry))); }
    }
    /** @param {string} name - Converted name. @returns {*} First public value or null. */
    get(name) { const id = this._nativeEntries.firstId(name); return id === null ? null : idlUtils.tryWrapperForImpl(this._entry(id).value); }
    /** @param {string} name - Converted name. @returns {Array} Public values in insertion order. */
    getAll(name) { return arrayFrom(this._nativeEntries.ids(name), (id) => idlUtils.tryWrapperForImpl(this._entry(id).value)); }
    /** @param {string} name - Converted name. @returns {boolean} Native membership. */
    has(name) { return this._nativeEntries.has(name); }
    /** @param {string} name - Converted name. @param {*} value - Converted value. @param {string} [filename] - Converted filename. @returns {void} Native replacement position and duplicate removal. */
    set(name, value, filename) {
      const entry = createAnEntry(name, value, filename); const file = typeof entry.value !== 'string';
      const result = this._nativeEntries.set(name, file ? null : entry.value);
      if (result === null) throw new RangeError('FormData set: entry identities exhausted');
      for (const id of result.removed) deleteEntry(this._entryValues, id);
      setEntry(this._entryValues, result.id, entry);
      if (this._view !== null) {
        setViewId(this._viewIds, entry, result.id);
        if (!result.existed) this._view.push(entry);
        else {
          this._view[result.index] = entry; const removed = createRemovedIds(result.removed);
          this._view = this._view.filter((item) => !hasRemovedId(removed, getViewId(this._viewIds, item)));
        }
      }
    }
    /** @yields {Array} Existing serializer/private iterator semantics; public iterators use direct native indexing. */
    *[Symbol.iterator]() { for (const entry of this._entries) yield [entry.name, idlUtils.tryWrapperForImpl(entry.value)]; }
  };
}
module.exports = { createFormDataImplementation };
