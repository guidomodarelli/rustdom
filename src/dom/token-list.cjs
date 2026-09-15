/** @file DOMTokenList ownership and mutation effects; validation and ordered token algorithms execute in Rust. */
'use strict';
const { TokenListMethod, TokenValidation } = require('../../dist/native.cjs');

/** Read-only compatibility view used by existing internal class-name queries. */
class TokenSetView {
  /** @param {object} tokens - Native shared token set, independent of the owning element. */
  constructor(tokens) { this._tokens = tokens; }
  /** @returns {number} Current token count of this specific set. */
  get size() { return this._tokens.size; }
  /** @param {string} token - Exact UTF-16 token. @returns {boolean} Membership. */
  contains(token) { return this._tokens.contains(token); }
  /** @param {number} index - Set offset. @returns {string|undefined} Current token. */
  get(index) { return this._tokens.get(index) ?? undefined; }
  /** @returns {IterableIterator<number>} Live indices of this set. */
  *keys() { for (let index = 0; index < this.size; index++) yield index; }
  /** @returns {IterableIterator<string>} Live values of this set. */
  *[Symbol.iterator]() { for (let index = 0; index < this.size; index++) yield this.get(index); }
  /** @param {Function} predicate - Existing internal query callback. @returns {boolean} Whether a token satisfies it. */
  some(predicate) {
    const length = this.size;
    for (let index = 0; index < length; index++) { const token = this.get(index); if (token !== undefined && predicate(token, index)) return true; }
    return false;
  }
}

/**
 * Bind native decisions to the real attribute hooks and exception realm.
 * @param {object} tree - Canonical native forest plus V8-visible owners.
 * @param {object} DOMException - Existing generated factory.
 * @param {object} idlUtils - Supported-index protocol symbols.
 * @param {Function} setAttributeValue - Real mutation driver, including observers and custom elements.
 * @returns {Function} Private DOMTokenList implementation.
 */
function createTokenListImplementation(tree, DOMException, idlUtils, setAttributeValue) {
  return class DOMTokenListImpl {
    /** @param {object} globalObject - Exception realm. @param {unknown[]} args - WebIDL arguments. @param {object} data - Owner, attribute and supported tokens. */
    constructor(globalObject, args, data) {
      this._globalObject = globalObject;
      this._element = data.element;
      this._attributeLocalName = data.attributeLocalName;
      this._nativeList = tree._arena.createTokenList(tree._ensure(this._element), this._attributeLocalName,
        data.supportedTokens ? [...data.supportedTokens] : undefined);
      this._tokenSetView = null;
    }
    /** @returns {void} Mark canonical attribute data dirty and discard only the owner's cached view. */
    attrModified() { this._nativeList.invalidate(); this._tokenSetView = null; }
    /** @returns {TokenSetView} Stable view until synchronization replaces the set. */
    get tokenSet() {
      if (this._tokenSetView === null) this._tokenSetView = new TokenSetView(tree._arena.tokenListSet(this._nativeList));
      return this._tokenSetView;
    }
    /** @returns {number} Synchronized native length. */
    get length() { return tree._arena.tokenListLength(this._nativeList); }
    /** @returns {IterableIterator<number>} Existing WebIDL indexed-property protocol. */
    get [idlUtils.supportedPropertyIndices]() { return this.tokenSet.keys(); }
    /** @param {number} index - Converted unsigned index. @returns {string|null} Token or null. */
    item(index) { return tree._arena.tokenListItem(this._nativeList, index) ?? null; }
    /** @param {string} token - Converted string; contains does not validate whitespace. @returns {boolean} */
    contains(token) { return tree._arena.tokenListContains(this._nativeList, token); }
    /** @param {number} method - Native operation. @param {string[]} tokens - Converted arguments. @param {boolean} [force] - Optional toggle force. @returns {boolean} Boolean result for toggle/replace. */
    _mutate(method, tokens, force) {
      const plan = tree._arena.tokenListMutate(this._nativeList, method, tokens, force);
      if (plan.status === TokenValidation.Empty) throw DOMException.create(this._globalObject, ['The token provided must not be empty.', 'SyntaxError']);
      if (plan.status === TokenValidation.Space) throw DOMException.create(this._globalObject, ['The token provided contains HTML space characters, which are not valid in tokens.', 'InvalidCharacterError']);
      if (plan.value !== undefined && plan.value !== null) setAttributeValue(this._element, this._attributeLocalName, plan.value);
      return plan.result;
    }
    /** @param {...string} tokens - Tokens to add. @returns {void} */
    add(...tokens) { this._mutate(TokenListMethod.Add, tokens); }
    /** @param {...string} tokens - Tokens to remove. @returns {void} */
    remove(...tokens) { this._mutate(TokenListMethod.Remove, tokens); }
    /** @param {string} token - Token to toggle. @param {boolean} [force] - Forced membership. @returns {boolean} */
    toggle(token, force = undefined) { return this._mutate(TokenListMethod.Toggle, [token], force); }
    /** @param {string} token - Existing token. @param {string} replacement - Replacement. @returns {boolean} */
    replace(token, replacement) { return this._mutate(TokenListMethod.Replace, [token, replacement]); }
    /** @param {string} token - Supported-token candidate. @returns {boolean} */
    supports(token) {
      const supported = this._nativeList.supports(token);
      if (supported === undefined || supported === null) throw new TypeError(`${this._attributeLocalName} attribute has no supported tokens`);
      return supported;
    }
    /** @returns {string} Raw reflected attribute without token normalization. */
    get value() { return tree._arena.tokenListValue(this._nativeList); }
    /** @param {string} value - Converted raw attribute value. */
    set value(value) { setAttributeValue(this._element, this._attributeLocalName, value); }
  };
}
module.exports = { createTokenListImplementation };
