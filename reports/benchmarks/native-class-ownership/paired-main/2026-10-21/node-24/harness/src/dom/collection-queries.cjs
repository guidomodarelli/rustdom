/** @module collection-queries Binds native getElementsBy* results to the existing live HTMLCollection realm and invalidation. */
'use strict';

/** @param {object} context - Pinned generated collection factory and canonical native tree. @returns {object} Private node helper exports. */
function createCollectionQueries({ HTMLCollection, domSymbolTree }) {
  /** @param {object} root - Real collection owner. @param {Function} query - Reads live native results. @returns {object} Existing realm-specific live collection. */
  function collection(root, query) {
    return HTMLCollection.createImpl(root._globalObject, [], { element: root, query });
  }
  return {
    /** @param {string} classNames - Converted query. @param {object} root - Document/Element owner. @returns {object} Live collection using the current document's quirks mode. */
    listOfElementsWithClassNames(classNames, root) {
      return collection(root, () => domSymbolTree.collectionByClass(root, classNames, root._ownerDocument.compatMode === 'BackCompat'));
    },
    /** @param {string} qualifiedName - Converted query. @param {object} root - Document/Element owner. @returns {object} Live collection with the original parsing mode. */
    listOfElementsWithQualifiedName(qualifiedName, root) {
      const htmlDocument = root._ownerDocument._parsingMode === 'html';
      return collection(root, () => domSymbolTree.collectionByTagName(root, qualifiedName, htmlDocument));
    },
    /** @param {string|null} namespace - Converted namespace. @param {string} localName - Converted local name. @param {object} root - Document/Element owner. @returns {object} Live collection. */
    listOfElementsWithNamespaceAndLocalName(namespace, localName, root) {
      return collection(root, () => domSymbolTree.collectionByNamespace(root, namespace, localName));
    },
  };
}

module.exports = { createCollectionQueries };
