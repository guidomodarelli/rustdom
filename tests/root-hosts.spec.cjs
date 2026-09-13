/** @file Compares real host traversals, event retargeting, parser routes and native registry contracts. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const adapters = {
  jsdom: { runtime: require('jsdom'), helpers: require('jsdom/lib/jsdom/living/helpers/shadow-dom'), implementation: require('jsdom/lib/jsdom/living/generated/utils').implForWrapper },
  rustdom: { runtime: require('../dist/index.cjs'), helpers: require('../dist/vendor-jsdom/lib/jsdom/living/helpers/shadow-dom'), implementation: require('../dist/vendor-jsdom/lib/jsdom/living/generated/utils').implForWrapper },
};

/** @param {object} adapter - Actual runtime and its helper module. @param {object} options - Parser route. @returns {object[]} Roots, ancestry and retargeting across moves and adoption. */
function inspectHosts(adapter, options) {
  const dom = new adapter.runtime.JSDOM('<main id="host"></main><template id="outer-template"><div>inert</div></template>', options);
  const foreign = new adapter.runtime.JSDOM('<aside></aside>');
  try {
    const document = dom.window.document; const host = document.querySelector('main');
    const root = host.attachShadow({ mode: 'closed' }); root.innerHTML = '<section><span>light</span><template><i>nested inert</i></template></section>';
    const nestedHost = root.querySelector('section'); const nestedTemplate = root.querySelector('template');
    const nestedRoot = nestedHost.attachShadow({ mode: 'open' }); nestedRoot.innerHTML = '<button>deep</button><slot></slot>';
    const button = nestedRoot.querySelector('button'); const slot = nestedRoot.querySelector('slot');
    const template = document.querySelector('template'); const fragment = document.createDocumentFragment();
    const attribute = document.createAttribute('name'); host.setAttributeNode(attribute);
    const nodes = [document, document.body, host, root, nestedHost, nestedRoot, button, slot, nestedHost.firstChild,
      template, template.content, template.content.firstChild, nestedTemplate, nestedTemplate.content,
      nestedTemplate.content.firstChild, attribute, fragment, foreign.window.document, foreign.window.document.body];
    const implementations = nodes.map(adapter.implementation); const observations = [];
    /** @returns {void} Captures only public results and helper identities. */
    function capture() {
      observations.push({ roots: nodes.map((node) => nodes.indexOf(node.getRootNode())),
        composed: nodes.map((node) => nodes.indexOf(node.getRootNode({ composed: true }))), connected: nodes.map((node) => node.isConnected),
        helperRoots: implementations.map((node) => implementations.indexOf(adapter.helpers.shadowIncludingRoot(node))),
        ancestry: implementations.flatMap((ancestor) => implementations.map((node) => adapter.helpers.isShadowInclusiveAncestor(ancestor, node))),
        retarget: implementations.flatMap((target) => implementations.map((reference) => implementations.indexOf(adapter.helpers.retarget(target, reference)))) });
    }
    assert.equal(adapter.helpers.isShadowInclusiveAncestor(dom.window, implementations[6]), false);
    assert.equal(adapter.helpers.isShadowInclusiveAncestor('not-a-node', implementations[6]), false);
    assert.equal(adapter.helpers.isShadowInclusiveAncestor(implementations[0], null), false);
    assert.throws(() => adapter.helpers.shadowIncludingRoot(null), TypeError);
    capture(); fragment.append(host); capture(); foreign.window.document.body.append(host); capture();
    assert.throws(() => nestedRoot.append(host), { name: 'HierarchyRequestError' });
    assert.throws(() => template.content.firstChild.append(template), { name: 'HierarchyRequestError' });
    assert.equal(slot.assignedNodes().length, 2);
    return observations;
  } finally { dom.window.close(); foreign.window.close(); }
}

for (const [route, options] of [['native', {}], ['locations', { includeNodeLocations: true }], ['scripts', { runScripts: 'dangerously' }]]) {
  test(`should preserve nested hosts and template boundaries through the ${route} parser route`, () => {
    assert.deepEqual(inspectHosts(adapters.rustdom, options), inspectHosts(adapters.jsdom, options));
  });
}

test('should preserve composed event paths and retargeted identities across closed and open roots', () => {
  const inspect = (adapter) => {
    const dom = new adapter.runtime.JSDOM('<main></main>');
    try {
      const document = dom.window.document; const host = document.querySelector('main'); const root = host.attachShadow({ mode: 'closed' });
      const nestedHost = root.appendChild(document.createElement('section')); const nestedRoot = nestedHost.attachShadow({ mode: 'open' });
      const button = nestedRoot.appendChild(document.createElement('button'));
      const nodes = [button, nestedRoot, nestedHost, root, host, document.body, document.documentElement, document, dom.window];
      const events = [];
      for (const node of nodes) {
        for (const capture of [true, false]) node.addEventListener('probe', (event) => events.push({ at: nodes.indexOf(node), capture,
          target: nodes.indexOf(event.target), phase: event.eventPhase, path: event.composedPath().map((entry) => nodes.indexOf(entry)) }), capture);
      }
      button.dispatchEvent(new dom.window.Event('probe', { bubbles: true, composed: false }));
      button.dispatchEvent(new dom.window.Event('probe', { bubbles: true, composed: true }));
      return events;
    } finally { dom.window.close(); }
  };
  assert.deepEqual(inspect(adapters.rustdom), inspect(adapters.jsdom));
});

test('should expose early host registration, atomic errors and cleanup through the real addon', () => {
  const { NativeTree } = require('../dist/native.cjs'); const tree = new NativeTree();
  const root = tree.reserveHandles(); const host = root + 1; const before = tree.statistics();
  assert.throws(() => tree.setRootHost(root, root, true), { code: 'InvalidArg' });
  assert.throws(() => tree.setRootHost(root, root + 1000, true), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), before);
  tree.setRootHost(root, host, true); assert.equal(tree.rootHost(root), host);
  assert.equal(tree.rootHostStatistics().hostedRoots, 1);
  const initialized = tree.statistics();
  assert.throws(() => tree.setData(root, '{"kind":1,"name":"wrong"}'), { code: 'InvalidArg' });
  assert.throws(() => tree.setData(host, '{"kind":11}'), { code: 'InvalidArg' });
  assert.deepEqual(tree.statistics(), initialized);
  tree.setData(root, '{"kind":11}'); tree.setHtmlElement(host, 'host', []);
  assert.equal(tree.shadowIncludingRoot(root), host); assert.equal(tree.isHostInclusiveAncestor(host, root), true);
  tree.setRootHost(root, host, false); assert.equal(tree.shadowIncludingRoot(root), root);
  assert.equal(tree.isShadowInclusiveAncestor(host, root), false);
  tree.release(host); assert.equal(tree.rootHost(root), 0); tree.release(root);
  assert.deepEqual(tree.rootHostStatistics(), { hostedRoots: 0, hostOwners: 0, rootCapacity: 0, ownerCapacity: 0 });
  assert.equal(tree.statistics().liveNodes, 0);
});

test('should collect obsolete parser roots and release nested host ownership after teardown', (context) => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/root-host-memory.cjs'], { encoding: 'utf8', timeout: 120_000 });
  assert.equal(child.status, 0, child.stderr || child.stdout); const report = JSON.parse(child.stdout);
  assert.equal(report.pass, true); context.diagnostic(JSON.stringify(report));
});
