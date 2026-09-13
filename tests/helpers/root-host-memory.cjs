/** @file Exercises real host ownership, obsolete parser roots and complete native registry cleanup. */
'use strict';
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const runtime = require('../../dist/index.cjs');
const { collectGarbage, captureMemoryState, waitForMemoryQuiescence } = require('../../scripts/memory-endpoint.cjs');
const references = { documents: [], windows: [], roots: [], hosts: [], nodes: [] };
const retainedStatistics = [];

/** @param {Document} document - Observed document. @param {Window} window - Observed Window. @param {Node[]} roots - Root wrappers. @param {Node[]} hosts - Host wrappers. @returns {void} Keeps only weak observations. */
function observe(document, window, roots, hosts) {
  references.documents.push(new WeakRef(document)); references.windows.push(new WeakRef(window));
  for (const root of roots) { references.roots.push(new WeakRef(root)); if (root.ownerDocument !== document) references.documents.push(new WeakRef(root.ownerDocument)); }
  for (const host of hosts) references.hosts.push(new WeakRef(host));
}

/** @param {object} baseline - Initial native counters. @returns {Promise<object>} Evidence that the replaced parse5 root disappears while its host stays alive. */
async function inspectObsoleteParserRoot(baseline) {
  const dom = new runtime.JSDOM('<template><i>content</i></template>', { includeNodeLocations: true });
  try {
    const template = dom.window.document.querySelector('template'); const content = template.content;
    observe(dom.window.document, dom.window, [content], [template]);
    const before = runtime.getNativeTreeStatistics().rootHosts;
    assert.equal(before.hostedRoots, baseline.rootHosts.hostedRoots + 2);
    let after;
    for (let round = 0; round < 12; round++) {
      await collectGarbage(); after = runtime.getNativeTreeStatistics().rootHosts;
      if (after.hostedRoots === baseline.rootHosts.hostedRoots + 1) break;
    }
    assert.equal(after.hostedRoots, baseline.rootHosts.hostedRoots + 1);
    assert.equal(after.hostOwners, baseline.rootHosts.hostOwners + 1);
    assert.equal(template.content, content); assert.equal(content.textContent, 'content');
    return { before, after };
  } finally { dom.window.close(); }
}

/** @returns {{root: ShadowRoot}} Deliberately retains only a root; its host must remain alive. */
function holdShadowRoot() {
  const dom = new runtime.JSDOM('<main></main>'); const host = dom.window.document.querySelector('main');
  const root = host.attachShadow({ mode: 'closed' }); root.append('held');
  observe(dom.window.document, dom.window, [root], [host]); dom.window.close(); return { root };
}

/** @param {number} index - Chooses native or parse5 route. @returns {void} Exercises nested ownership and retains only weak observations and scalar snapshots. */
function exercise(index) {
  const dom = new runtime.JSDOM('<main></main><template><i>inert</i></template>', index % 2 ? { includeNodeLocations: true } : {});
  try {
    const document = dom.window.document; const host = document.querySelector('main'); const template = document.querySelector('template');
    const root = host.attachShadow({ mode: 'closed' }); const nestedHost = root.appendChild(document.createElement('section'));
    const nestedRoot = nestedHost.attachShadow({ mode: 'open' }); const child = nestedRoot.appendChild(document.createElement('b'));
    assert.equal(child.getRootNode({ composed: true }), document); assert.equal(child.isConnected, true);
    assert.equal(template.content.firstChild.getRootNode({ composed: true }), template.content);
    assert.throws(() => nestedRoot.append(host), { name: 'HierarchyRequestError' });
    host.remove(); assert.equal(child.getRootNode({ composed: true }), host); assert.equal(child.isConnected, false);
    observe(document, dom.window, [root, nestedRoot, template.content], [host, nestedHost, template]);
    references.nodes.push(new WeakRef(child)); retainedStatistics.push(runtime.getNativeTreeStatistics().rootHosts);
  } finally { dom.window.close(); }
}

/** @returns {Promise<void>} Emits and persists scalar GC evidence without retaining DOM targets in the report. */
async function main() {
  await collectGarbage(); const baseline = runtime.getNativeTreeStatistics();
  const obsolete = await inspectObsoleteParserRoot(baseline);
  const parserReleased = await waitForMemoryQuiescence({ label: 'parser-host-scope', expectedNative: baseline,
    sample: () => captureMemoryState(references, runtime) });
  assert.equal(parserReleased.reached, true);
  let held = holdShadowRoot(); await collectGarbage();
  const heldState = captureMemoryState(references, runtime);
  assert.ok(heldState.survivors.hosts > 0); assert.ok(heldState.survivors.roots > 0);
  assert.ok(held.root.host); held = null;
  const released = await waitForMemoryQuiescence({ label: 'released-held-root', expectedNative: baseline,
    sample: () => captureMemoryState(references, runtime) });
  assert.equal(released.reached, true);
  const cycles = [];
  for (let batch = 0; batch < 5; batch++) {
    for (let index = 0; index < 50; index++) exercise(index);
    const endpoint = await waitForMemoryQuiescence({ label: `host-batch-${batch}`, expectedNative: baseline,
      sample: () => captureMemoryState(references, runtime) });
    assert.equal(endpoint.reached, true); assert.deepEqual(endpoint.state.nativeTree.rootHosts, baseline.rootHosts);
    cycles.push(endpoint);
  }
  const report = { capturedAt: new Date().toISOString(), node: process.version, pass: true,
    observed: Object.fromEntries(Object.entries(references).map(([name, entries]) => [name, entries.length])),
    retainedStatistics: retainedStatistics.length, obsolete, parserReleased, heldState, released, cycles,
    limitations: 'Finite GC and registry checks; not a proof of absence of every leak or a peak-memory measurement.' };
  const path = `reports/memory/${report.capturedAt.replaceAll(':', '-')}-root-hosts.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(JSON.stringify({ pass: report.pass, node: report.node, observed: report.observed,
    obsolete, finalHosts: cycles.at(-1).state.nativeTree.rootHosts, path }));
}
main().catch((error) => { process.stderr.write(error.stack); process.exitCode = 1; });
