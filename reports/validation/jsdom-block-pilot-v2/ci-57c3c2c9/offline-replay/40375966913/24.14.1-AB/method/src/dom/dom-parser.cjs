/** @module dom-parser Connects native parser dispatch and recovery to original realms and parser/factory primitives. */
'use strict';
const { DomParserOperation, domParserOperation } = require('../../dist/native.cjs');

/** @param {object} context - Actual generated Document, IDL utilities and parser entry point. @returns {Function} Private DOMParser implementation. */
function createDomParserImplementation({ Document, idlUtils, parseIntoDocument }) {
  const helpers = {
    /** @param {unknown} contentType - Original converted MIME argument. @returns {unknown} Preserve the reference's observable global String call. */
    contentTypeString(contentType) { return String(contentType); },
    /** @returns {never} Preserve the current host constructor and its original diagnostic. */
    invalidContentType() { throw new TypeError('Invalid contentType'); },
    /** @this {object} Actual parser receiver. @param {string} parsingMode - Native dispatch decision. @param {unknown} contentType - Original MIME argument. @param {unknown} string - Original markup. @returns {object} Real document; preserve three-argument invocation. */
    parseDocument(parsingMode, contentType, string) { return this.createScriptingDisabledDocument(parsingMode, contentType, string); },
    /** @this {object} Actual parser receiver. @param {string} parsingMode - Native dispatch decision. @param {unknown} contentType - Original MIME argument. @returns {object} Preserve the two-argument recovery invocation. */
    emptyDocument(parsingMode, contentType) { return this.createScriptingDisabledDocument(parsingMode, contentType); },
    /** @param {object} owner - Parser whose realm must be looked up again. @returns {unknown} Original document URL. */
    documentUrl(owner) { return idlUtils.implForWrapper(owner._globalObject._document).URL; },
    /** @param {object} globalObject - First captured realm. @param {unknown} parsingMode - Original mode. @param {unknown} contentType - Original MIME value. @param {unknown} url - Owner URL. @returns {object} Actual document with original literal options. */
    createDocument(globalObject, parsingMode, contentType, url) {
      return Document.createImpl(globalObject, [], { options: { parsingMode, encoding: 'UTF-8', contentType, readyState: 'complete', scriptingDisabled: true, url } });
    },
    /** @param {unknown} string - Original markup. @param {object} document - Actual destination. @returns {void} Invoke the installed parser entry point. */
    parseIntoDocument(string, document) { parseIntoDocument(string, document); },
    /** @param {object} document - Recovery document. @param {string} namespace - Native error namespace. @param {string} name - Native local name. @returns {object} Actual parsererror element. */
    createParserError(document, namespace, name) { return document.createElementNS(namespace, name); },
    /** @param {object} element - Actual parsererror. @param {unknown} error - Original thrown value. @returns {void} Preserve message lookup before strict textContent assignment. */
    writeParserError(element, error) { element.textContent = error.message; },
    /** @param {object} document - Recovery document. @param {object} element - Actual error element. @returns {void} Preserve method lookup and invocation. */
    appendParserError(document, element) { document.appendChild(element); },
  };
  /** Retains the realm as an ordinary edge visible to the JavaScript collector. */
  return class DOMParserImpl {
    /** @param {object} globalObject - Actual wrapper realm. */
    constructor(globalObject) { this._globalObject = globalObject; }
    /** @param {unknown} string - Converted markup. @param {unknown} contentType - Converted MIME argument. @returns {object} Parsed or parsererror document. */
    parseFromString(string, contentType) { return domParserOperation(this, DomParserOperation.ParseFromString, [string, contentType], helpers); }
    /** @param {unknown} parsingMode - Original mode. @param {unknown} contentType - Original MIME argument. @param {unknown} string - Optional markup. @returns {object} Actual scripting-disabled document. */
    createScriptingDisabledDocument(parsingMode, contentType, string) { return domParserOperation(this, DomParserOperation.CreateScriptingDisabledDocument, [parsingMode, contentType, string], helpers); }
  };
}
module.exports = { createDomParserImplementation };
