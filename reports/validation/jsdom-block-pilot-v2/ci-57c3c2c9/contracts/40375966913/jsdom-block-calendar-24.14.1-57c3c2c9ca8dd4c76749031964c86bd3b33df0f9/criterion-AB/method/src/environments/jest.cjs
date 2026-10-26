/** @module rustdom/jest Integrates with Jest's official reusable jsdom environment. */
'use strict';

/** Reuse Jest's VM, fake timers, error handling, globals, and teardown implementation. */
const { default: BaseEnvironment } = require('@jest/environment-jsdom-abstract');
/** Provide the private native-backed jsdom runtime as an explicit dependency. */
const runtime = require('../../dist/index.cjs');

/**
 * Preserve the Jest jsdom environment contract using the official injection boundary.
 * @extends BaseEnvironment
 */
class RustdomEnvironment extends BaseEnvironment {
  /**
   * Initialize the upstream environment with the rustdom implementation.
   * @param {object} configuration - Jest global and project configuration.
   * @param {object} context - Jest environment context and console.
   */
  constructor(configuration, context) {
    super(configuration, context, runtime);
  }
}

module.exports = RustdomEnvironment;
