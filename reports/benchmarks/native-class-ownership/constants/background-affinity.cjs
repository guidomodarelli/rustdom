/** @module ownership-background-affinity-settings Declares a separate CPU pool without changing the public sampler. */
'use strict';
const original = require('./row-isolation.cjs');
module.exports = { ...original, revision: 'background-affinity-v1',
  affinityRevision: 'disjoint-background-v1', initialCpuList: '0-15', backgroundCpuList: '0-1,3-15' };
