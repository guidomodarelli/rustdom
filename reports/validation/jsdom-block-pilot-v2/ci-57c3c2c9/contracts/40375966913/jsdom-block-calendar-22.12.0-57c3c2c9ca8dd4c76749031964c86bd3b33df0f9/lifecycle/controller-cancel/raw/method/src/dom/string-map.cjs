/** @file Dataset ownership and attribute effects around stateless Rust name/lookup algorithms. */
'use strict';
const { DatasetNameStatus } = require('../../dist/native.cjs');

/**
 * Preserve the generated Proxy contract and existing attribute hooks.
 * @param {object} tree - Canonical native forest.
 * @param {object} DOMException - Realm-specific factory.
 * @param {object} idlUtils - Named-property protocol symbols.
 * @param {object} attributes - Existing set/remove drivers.
 * @returns {Function} Private DOMStringMap implementation.
 */
function createStringMapImplementation(tree, DOMException, idlUtils, attributes) {
  return class DOMStringMapImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - Constructor arguments. @param {object} data - Actual owner. */
    constructor(globalObject, args, data) { this._globalObject = globalObject; this._element = data.element; }
    /** @returns {string[]} Native deduplicated names in attribute order. */
    get [idlUtils.supportedPropertyNames]() { return tree._arena.datasetNames(tree._ensure(this._element)); }
    /** @param {string} name - Named-property key. @returns {string|undefined} First local-name match, including namespaces. */
    [idlUtils.namedGet](name) { return tree._arena.datasetValue(tree._ensure(this._element), name) ?? undefined; }
    /** @param {string} name - Converted property name. @param {string} value - Converted DOMString value. @returns {void} Applies real mutation effects after native validation. */
    [idlUtils.namedSetNew](name, value) {
      const plan = tree._arena.datasetNamePlan(name, true);
      if (plan.status === DatasetNameStatus.InvalidProperty) throw DOMException.create(this._globalObject, [`'${name}' is not a valid property name`, 'SyntaxError']);
      if (plan.status === DatasetNameStatus.InvalidName) throw DOMException.create(this._globalObject, [`"${plan.attribute}" did not match the Name production`, 'InvalidCharacterError']);
      attributes.setAttributeValue(this._element, plan.attribute, value);
    }
    /** @param {string} name - Property name. @param {string} value - Converted value. @returns {void} */
    [idlUtils.namedSetExisting](name, value) { this[idlUtils.namedSetNew](name, value); }
    /** @param {string} name - Property to remove. @returns {void} Preserve deletion by qualified name without setter validation. */
    [idlUtils.namedDelete](name) { attributes.removeAttributeByName(this._element, tree._arena.datasetNamePlan(name, false).attribute); }
  };
}
module.exports = { createStringMapImplementation };
