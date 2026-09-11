/** @module rustdom/private-require Resolves private jsdom dependencies from the pinned upstream package in isolated installations. */
'use strict';
const { createRequire } = require('node:module');
const { isAbsolute } = require('node:path');
/** Preserve jsdom's dependency graph under npm and non-hoisted package managers. */
const upstreamRequire = createRequire(require.resolve('jsdom/package.json'));

/**
 * Keep relative files in the private copy and bare dependencies in jsdom's own dependency graph.
 * @param {NodeRequire} localRequire - Unmodified module-local require of one private jsdom file.
 * @returns {NodeRequire} A module-local resolver with the same auxiliary properties.
 */
module.exports = function createPrivateRequire(localRequire) {
  /** @param {string} specifier - CommonJS module specifier. @returns {NodeRequire} Its owning resolver. */
  const resolver = (specifier) => specifier.startsWith('.') || isAbsolute(specifier) ? localRequire : upstreamRequire;
  /** @param {string} specifier - Module to load. @returns {*} The module's actual exports. */
  function privateRequire(specifier) { return resolver(specifier)(specifier); }
  Object.assign(privateRequire, localRequire);
  privateRequire.resolve = (specifier, options) => resolver(specifier).resolve(specifier, options);
  privateRequire.resolve.paths = (specifier) => resolver(specifier).resolve.paths(specifier);
  return privateRequire;
};
