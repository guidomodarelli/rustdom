/** @module rustdom/native Loads the actual host Node-API binary produced by Cargo. */
'use strict';

// No JavaScript fallback: installation or ABI errors must be visible to callers.
module.exports = require('./rustdom.node');
