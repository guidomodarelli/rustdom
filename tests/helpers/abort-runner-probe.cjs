/** @file Records actual host, pure DOM and Vitest-bridge abort behavior on the executing Node version. */
'use strict';
const { writeFileSync, mkdirSync } = require('node:fs');
/** Capture host constructors before loading or installing a DOM environment. */
const host = { AbortController, AbortSignal, EventTarget, Event };
const runtime = require('@rustdom/rustdom');
const reference = require('jsdom');

/** @param {object} scope - Real constructor set or window. @returns {object} Scalar identity evidence and observable abort results. */
function observe(scope) {
  const before = runtime.getNativeTreeStatistics().abortStates.created;
  const controller = new scope.AbortController();
  const signal = scope.AbortSignal.any([controller.signal]);
  const nested = scope.AbortSignal.any([signal]);
  const target = new scope.EventTarget(); const trace = [];
  target.addEventListener('work', () => trace.push('stale'), { signal: nested });
  signal.onabort = () => trace.push('replaced'); signal.onabort = null;
  signal.onabort = () => trace.push('signal');
  nested.addEventListener('abort', () => { target.dispatchEvent(new scope.Event('work')); trace.push('nested'); }, { once: true });
  controller.signal.addEventListener('abort', () => trace.push('source'));
  controller.abort('winner');
  return { controllerIsHost: scope.AbortController === host.AbortController, signalIsHost: scope.AbortSignal === host.AbortSignal,
    trace, nativeStatesCreated: runtime.getNativeTreeStatistics().abortStates.created - before, reasons: [signal.reason, nested.reason] };
}

/** @returns {Promise<void>} Saves the version matrix without treating host Node ordering as the Rust DOM contract. */
async function main() {
  const dom = new runtime.JSDOM(''); const referenceDom = new reference.JSDOM('');
  const { default: environment } = await import('../../src/environments/vitest.mjs');
  const target = { setTimeout, clearTimeout }; const session = environment.setup(target, {});
  try {
    const report = { node: process.version, jsdomVersion: require('jsdom/package.json').version,
      nativeBuild: require('../../dist/native-build.json'), host: observe(host),
      jsdom: observe(referenceDom.window), rustdom: observe(dom.window), environment: observe(target),
      aliases: { windowIsPopulatedGlobal: target.window === target, windowAbortIsHost: target.jsdom.window.AbortController === host.AbortController } };
    mkdirSync('reports/validation/abort-runner-node24', { recursive: true });
    writeFileSync(`reports/validation/abort-runner-node24/probe-${process.version}.json`, JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally { session.teardown(); dom.window.close(); referenceDom.window.close(); }
}
main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
