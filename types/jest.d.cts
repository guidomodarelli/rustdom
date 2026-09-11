/** Jest 30 environment backed by rustdom. */
import BaseEnvironment from '@jest/environment-jsdom-abstract';
import type { EnvironmentContext, JestEnvironmentConfig } from '@jest/environment';

/** Injects rustdom while retaining Jest's real timers, VM and teardown implementation. */
declare class RustdomEnvironment extends BaseEnvironment {
  /** @param configuration - Jest configuration. @param context - Runner context. */
  constructor(configuration: JestEnvironmentConfig, context: EnvironmentContext);
}
export = RustdomEnvironment;
