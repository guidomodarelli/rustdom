/** @file Fixed opt-in warmup policy for the four ownership operation families. */
'use strict';
module.exports = {
  rounds: 3,
  gcOrder: { beforeWarmup: 'before-warmup', afterWarmup: 'after-warmup' },
  workloads: ['range-control-1000', 'range-state-lifecycle-1000',
    'mutation-records-collect', 'observer-delivery-records'],
};
