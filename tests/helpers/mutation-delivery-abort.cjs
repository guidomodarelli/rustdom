/** @file Exercises a throwing VirtualConsole reporter in isolation, preserving Node's real rejection event. */
'use strict';
const assert = require('node:assert/strict');
const runtime = process.argv[2] === 'jsdom' ? require('jsdom') : require('../../dist/index.cjs');

/** @returns {Promise<void>} Confirms aborted batches discard captured slots without losing later queued records. */
async function main() {
  const trace = []; const errors = [];
  const onRejection = (error) => { errors.push(error.message); trace.push('rejection'); };
  process.on('unhandledRejection', onRejection);
  const virtualConsole = new runtime.VirtualConsole();
  virtualConsole.on('jsdomError', () => { trace.push('reporter'); throw new Error('reporter failure'); });
  const dom = new runtime.JSDOM('<main></main>', { virtualConsole }); const host = dom.window.document.querySelector('main');
  const root = host.attachShadow({ mode: 'closed' }); root.innerHTML = '<slot>fallback</slot>'; const slot = root.firstChild;
  slot.addEventListener('slotchange', () => { trace.push('slot'); }); let changed = false;
  const first = new dom.window.MutationObserver(() => {
    trace.push(changed ? 'first-again' : 'first');
    if (!changed) { changed = true; host.setAttribute('flag', 'two'); throw new Error('observer failure'); }
  });
  const second = new dom.window.MutationObserver((records) => { trace.push(`second-${records.length}`); });
  try {
    first.observe(host, { attributes: true }); second.observe(host, { attributes: true });
    await new Promise((resolve) => setImmediate(resolve)); trace.length = 0;
    slot.append('more'); host.setAttribute('flag', 'one');
    await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(trace, ['first', 'reporter', 'first-again', 'second-2', 'rejection']);
    assert.deepEqual(errors, ['reporter failure']);
    assert.deepEqual(first.takeRecords(), []); assert.deepEqual(second.takeRecords(), []);
    process.stdout.write(`${JSON.stringify({ pass: true, trace, errors })}\n`);
  } finally { first.disconnect(); second.disconnect(); dom.window.close(); process.removeListener('unhandledRejection', onRejection); }
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
