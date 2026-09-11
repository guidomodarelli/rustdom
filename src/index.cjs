/** @module rustdom Preserves upstream jsdom exports while substituting a private HTML parser. */
'use strict';

/** The build redirects this dependency to a private copy of the upstream runtime. */
const jsdom = require('jsdom');
/** Share instrumentation with the parser inside that same private runtime. */
const { getParserStatistics } = require('./parser/bridge.cjs');

module.exports = { ...jsdom, getParserStatistics };
