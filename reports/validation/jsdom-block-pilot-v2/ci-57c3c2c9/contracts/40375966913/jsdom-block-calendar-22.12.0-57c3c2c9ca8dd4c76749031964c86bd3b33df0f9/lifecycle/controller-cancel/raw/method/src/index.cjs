/** @module rustdom Preserves upstream jsdom exports while substituting a private HTML parser. */
'use strict';

/** The build redirects this dependency to a private copy of the upstream runtime. */
const jsdom = require('jsdom');
/** Share instrumentation with the parser inside that same private runtime. */
const { getParserStatistics } = require('./parser/bridge.cjs');
/** Read the same native forest used by the private runtime's actual nodes. */
const { domSymbolTree } = require('../dist/vendor-jsdom/lib/jsdom/living/helpers/internal-constants.js');

/** @returns {object} Native allocation and mutation counters for diagnostics and benchmarks. */
function getNativeTreeStatistics() { return domSymbolTree.statistics(); }

module.exports = { ...jsdom, getParserStatistics, getNativeTreeStatistics };
