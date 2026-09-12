/** @module rustdom/lifecycle Runs every cleanup operation and preserves primary and secondary failures. */
'use strict';

/** Keep diagnostics available even if application code replaces exposed error globals. */
const HostAggregateError = AggregateError;

/**
 * Release every resource before reporting failures, including an optional original initialization failure.
 * @param {Function[]} releases - Synchronous cleanup operations in dependency order.
 * @param {unknown[]} [initialErrors] - Previous failures to preserve before cleanup errors.
 * @returns {void} Completes all operations when no failure occurred.
 * @throws {*} Preserves a sole failure; aggregates multiple failures with the first as cause.
 */
function releaseResources(releases, initialErrors = []) {
  const errors = [...initialErrors];
  for (const release of releases) {
    try { release?.(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new HostAggregateError(errors, 'rustdom environment: resource cleanup failed', { cause: errors[0] });
  }
}

module.exports = { releaseResources };
