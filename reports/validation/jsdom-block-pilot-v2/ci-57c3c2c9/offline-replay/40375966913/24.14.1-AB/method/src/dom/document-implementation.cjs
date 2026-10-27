/** @module document-implementation Connects native creation control to realm factories and GC-visible owners. */
'use strict';
const { DocumentImplementationOperation, documentImplementationOperation } = require('../../dist/native.cjs');

/** @param {object} context - Captured platform factories and namespace constants. @returns {Function} Private DOMImplementation class. */
function createDocumentImplementation(context) {
  const { DocumentType, DOMException, documents, createElement, internalCreateElementNSSteps, HTML_NS } = context;
  const helpers = {
    /** @param {object} globalObject - Wrapper realm. @param {unknown} name - Original converted argument. @returns {never} Preserve the reference's second coercion on invalid input. */
    throwQNameError(globalObject, name) { throw DOMException.create(globalObject, [`"${name}" did not match the QName production`, 'InvalidCharacterError']); },
    /** @param {object} globalObject - Wrapper realm. @param {object} ownerDocument - Current owner. @param {unknown} name - Original name. @param {unknown} publicId - Original public identifier. @param {unknown} systemId - Original system identifier. @returns {object} Actual DocumentType implementation. */
    createDocumentType(globalObject, ownerDocument, name, publicId, systemId) { return DocumentType.createImpl(globalObject, [], { ownerDocument, name, publicId, systemId }); },
    /** @param {object} globalObject - Wrapper realm. @param {string} contentType - Native MIME decision. @returns {object} Actual XML document. */
    createXmlDocument(globalObject, contentType) { return documents.createImpl(globalObject, { contentType, parsingMode: 'xml', encoding: 'UTF-8' }); },
    /** @param {object} globalObject - Wrapper realm. @returns {object} Actual HTML document; contentType remains absent from options. */
    createHtmlDocument(globalObject) { return documents.createImpl(globalObject, { parsingMode: 'html', encoding: 'UTF-8' }); },
    /** @param {object} document - Owner document. @param {unknown} namespace - Original namespace argument. @param {unknown} qualifiedName - Original name argument. @returns {object} Actual namespaced element. */
    createElementNS(document, namespace, qualifiedName) { return internalCreateElementNSSteps(document, namespace, qualifiedName, {}); },
    /** @param {object} document - Owner document. @param {string} name - Native element-name decision. @returns {object} Actual HTML element. */
    createHtmlElement(document, name) { return createElement(document, name, HTML_NS); },
    /** @param {object} document - Actual document. @param {unknown} title - Original title argument. @returns {object} Actual text implementation. */
    createTextNode(document, title) { return document.createTextNode(title); },
    // Separate call sites preserve reference expressions and intrinsic diagnostics for non-callable methods.
    /** @param {object} document - Actual parent. @param {object} node - Actual child. @returns {void} */
    appendToDocument(document, node) { document.appendChild(node); },
    /** @param {object} htmlElement - Actual parent. @param {object} node - Actual child. @returns {void} */
    appendToHtml(htmlElement, node) { htmlElement.appendChild(node); },
    /** @param {object} headElement - Actual parent. @param {object} node - Actual child. @returns {void} */
    appendToHead(headElement, node) { headElement.appendChild(node); },
    /** @param {object} titleElement - Actual parent. @param {object} node - Actual child. @returns {void} */
    appendToTitle(titleElement, node) { titleElement.appendChild(node); },
    /** @param {object} document - Created document. @param {object} owner - DOMImplementation receiver. @returns {void} Preserve late origin lookup and strict assignment. */
    copyOrigin(document, owner) { document._origin = owner._ownerDocument._origin; },
  };
  /** Retains realm and document owners as ordinary JavaScript edges. */
  return class DOMImplementationImpl {
    /** @param {object} globalObject - Actual wrapper realm. @param {unknown[]} args - Converted constructor arguments. @param {object} privateData - Original associated document. */
    constructor(globalObject, args, privateData) { this._globalObject = globalObject; this._ownerDocument = privateData.ownerDocument; }
    /** @returns {boolean} Legacy capability result. */
    hasFeature() { return documentImplementationOperation(this, DocumentImplementationOperation.HasFeature, undefined, helpers); }
    /** @param {unknown} qualifiedName - Converted name. @param {unknown} publicId - Converted public identifier. @param {unknown} systemId - Converted system identifier. @returns {object} Created doctype. */
    createDocumentType(qualifiedName, publicId, systemId) { return documentImplementationOperation(this, DocumentImplementationOperation.CreateDocumentType, [qualifiedName, publicId, systemId], helpers); }
    /** @param {unknown} namespace - Converted namespace. @param {unknown} qualifiedName - Converted name. @param {object|null} doctype - Original optional doctype. @returns {object} Created XML document. */
    createDocument(namespace, qualifiedName, doctype) { return documentImplementationOperation(this, DocumentImplementationOperation.CreateDocument, [namespace, qualifiedName, doctype], helpers); }
    /** @param {unknown} title - Converted optional title, including undefined. @returns {object} Created HTML document. */
    createHTMLDocument(title) { return documentImplementationOperation(this, DocumentImplementationOperation.CreateHtmlDocument, [title], helpers); }
  };
}
module.exports = { createDocumentImplementation };
