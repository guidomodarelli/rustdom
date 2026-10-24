/** @file Scope and interpretation of the post-hoc process-level archive audit. */
'use strict';
module.exports = {
  PRECISION_REVISION: 'main-affinity-precision-v1',
  PRECISION_LIMITS: [
    'No new timings, sample filtering, outlier rejection, acceptance changes or adaptive benchmark runs.',
    'Each full label/engine/row contains eight processes and 72 durations, not 72 processes.',
    'Halves and adjacent blocks reuse observations; they are not independent replications or confidence intervals.',
    'Partitions preserve label balance but were examined after the study; they do not replace its predeclared estimator.',
    'Contrasts alone identify neither scheduler/JIT/host causes nor a causal effect of the SDK.',
    'No sample-size, statistical-power or population-precision claim is inferred from this finite descriptive audit.',
  ],
};
