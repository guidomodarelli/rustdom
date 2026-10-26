/** @module ownership-row-isolation-settings Partitions each original treatment into one process per public workload. */
'use strict';
const original = require('./seeded-pre-gc.cjs');
module.exports = { ...original, revision: 'row-isolation-v1', rowPartition: 'process' };
