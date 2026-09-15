/** @file Option binding for the native XML serializer; DOM exception realms remain with their callers. */
'use strict';
const { serializeXml, serializeXmlForest } = require('../../dist/native.cjs');

/** @param {Node} root - Public node, including observable overridden getters. @param {object} [options] - Existing serializer options. @param {boolean} [options.requireWellFormed=false] - Enable the reference's XML checks. @returns {unknown} XML text or an overridden root Text replacement result. */
module.exports = (root, { requireWellFormed = false } = {}) => serializeXml(root, !!requireWellFormed);

/** @param {Node[]} roots - Snapshot roots in original order. @param {boolean} requireWellFormed - Existing XML checks. @returns {string} Concatenation with independent namespace scopes. */
module.exports.serializeForest = (roots, requireWellFormed) => serializeXmlForest(roots, !!requireWellFormed);
