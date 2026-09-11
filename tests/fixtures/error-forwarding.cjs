/** @file Exercises the real process error boundary outside node:test's own uncaught-exception handling. */
'use strict';

/**
 * Dispatch actual browser errors and report which public error handlers observe them.
 * @returns {Promise<void>} Emits counters after restoring the real process globals.
 */
async function main() {
  const { default: environment } = await import('../../src/environments/vitest.mjs');
  const session = environment.setup(globalThis, {});
  let unhandled = 0;
  let handled = 0;
  const onUnhandled = () => { unhandled++; };
  process.on('uncaughtException', onUnhandled);
  try {
    const window = globalThis.jsdom.window;
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('expected-unhandled'), cancelable: true }));
    const onHandled = () => { handled++; };
    window.addEventListener('error', onHandled);
    window.addEventListener('error', onHandled);
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('expected-handled'), cancelable: true }));
    window.removeEventListener('error', onHandled);
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('after-duplicate-removal'), cancelable: true }));
    window.addEventListener('error', onHandled, { once: true });
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('handled-once'), cancelable: true }));
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('after-once'), cancelable: true }));
    window.addEventListener('error', null);
    window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('after-null'), cancelable: true }));
  } finally {
    process.removeListener('uncaughtException', onUnhandled);
    session.teardown();
  }
  process.stdout.write(JSON.stringify({ unhandled, handled }));
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
