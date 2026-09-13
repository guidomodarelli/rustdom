/** @file Exercises observer registration, replacement, filtering and ordering against the independent reference. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
/** Both engines exercise their actual observers and generated WebIDL conversion. */
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };

test('should expose atomic native registration, ordered interests and cleanup without reverse action indexes', () => {
  const { NativeTree, ObservationStatus } = require('../dist/native.cjs');
  const tree = new NativeTree(); const parent = tree.allocate(); const target = tree.allocate(); tree.append(parent, target);
  const first = tree.allocateMutationObserver(); const second = tree.allocateMutationObserver();
  assert.equal(tree.observeMutations(first, parent, { attributeOldValue: true, subtree: true }), ObservationStatus.Added);
  const filter = ['flag'];
  assert.equal(tree.observeMutations(second, target, { attributeFilter: filter }), ObservationStatus.Added); filter.length = 0;
  assert.deepEqual(tree.interestedMutationObservers(target, 'attributes', 'flag', null), [{ observer: second, oldValue: false }, { observer: first, oldValue: true }]);
  const before = tree.observerRegistryStatistics(); const topologyBefore = tree.statistics();
  assert.equal(tree.observeMutations(second, target, { attributes: false, attributeOldValue: true, childList: true }), ObservationStatus.AttributeOldValueWithoutAttributes);
  assert.equal(tree.observeMutations(second, target, {}), ObservationStatus.MissingMutationKind);
  for (const invalid of [0, -1, 0.5, NaN, Infinity, 999]) {
    assert.throws(() => tree.observeMutations(invalid, target, { childList: true }), { code: 'InvalidArg' });
    assert.throws(() => tree.observeMutations(first, invalid, { childList: true }), { code: 'InvalidArg' });
    assert.throws(() => tree.interestedMutationObservers(invalid, 'childList', null, null), { code: 'InvalidArg' });
  }
  assert.deepEqual(tree.observerRegistryStatistics(), before); assert.deepEqual(tree.statistics(), topologyBefore);
  assert.deepEqual(tree.interestedMutationObservers(target, 'attributes', 'flag', null), [{ observer: second, oldValue: false }, { observer: first, oldValue: true }]);
  assert.equal(tree.observeMutations(second, target, { characterDataOldValue: false }), ObservationStatus.Replaced);
  assert.deepEqual(tree.interestedMutationObservers(target, 'characterData'), [{ observer: second, oldValue: false }]);
  assert.deepEqual(tree.disconnectMutationObserver(first), [parent]); assert.deepEqual(tree.disconnectMutationObserver(first), []);
  tree.release(target); assert.equal(tree.observerRegistryStatistics().registrations, 0);
  assert.equal(tree.releaseMutationObserver(second), true); assert.equal(tree.releaseMutationObserver(second), false);
  tree.releaseMutationObserver(first); tree.release(parent);
  for (const value of Object.values(tree.observerRegistryStatistics())) assert.equal(value, 0);
  assert.equal(ObservationStatus[ObservationStatus.Added], undefined);
  assert.throws(() => Reflect.apply(tree.observeMutations, {}, [first, parent, {}]), { name: 'TypeError' });
});

test('should release unreferenced targets while observers stay alive and clear all native registrations afterward', () => {
  const child = spawnSync(process.execPath, ['--expose-gc', 'tests/helpers/mutation-observer-memory.cjs', 'rustdom'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr || child.stdout);
  const report = JSON.parse(child.stdout); assert.equal(report.pass, true); assert.equal(report.cycles, 2);
  assert.equal(report.liveTargetDelivered, 1);
});

for (const [name, runtime] of Object.entries(runtimes)) {
  test(`should finish WebIDL getter effects before rejecting replacement options with the pinned exception realm in ${name}`, () => {
    const dom = new runtime.JSDOM('<main flag="old"></main>', { runScripts: 'outside-only' });
    const target = dom.window.document.querySelector('main'); const observer = new dom.window.MutationObserver(() => {});
    try {
      observer.observe(target, { attributes: true, attributeOldValue: true });
      const reads = []; const options = {};
      const members = ['attributeFilter', 'attributeOldValue', 'attributes', 'characterData', 'characterDataOldValue', 'childList', 'subtree'];
      for (const member of members) Object.defineProperty(options, member, { get() {
        reads.push(member);
        if (member === 'attributeFilter') { target.setAttribute('flag', 'during conversion'); return ['flag']; }
        if (member === 'attributes') return false;
        if (member === 'childList') return true;
        return undefined;
      } });
      assert.throws(() => observer.observe(target, options), (error) => {
        assert.equal(error.constructor, TypeError); assert.equal(error instanceof dom.window.TypeError, false);
        assert.equal(error.message, "The options object may only set 'attributeFilter' when 'attributes' is true or not present.");
        return true;
      });
      assert.deepEqual(reads, members);
      const duringConversion = observer.takeRecords(); assert.equal(duringConversion.length, 1);
      assert.equal(duringConversion[0].target, target); assert.equal(duringConversion[0].oldValue, 'old');
      target.setAttribute('flag', 'after rejection'); const unchanged = observer.takeRecords();
      assert.equal(unchanged.length, 1); assert.equal(unchanged[0].oldValue, 'during conversion');
    } finally { observer.disconnect(); dom.window.close(); }
  });

  test(`should derive observation kinds from present old-value options and preserve failed replacements in ${name}`, () => {
    const dom = new runtime.JSDOM('<main></main>'); const document = dom.window.document;
    const target = document.querySelector('main'); const text = target.appendChild(document.createTextNode('first'));
    const observer = new dom.window.MutationObserver(() => {});
    try {
      observer.observe(target, { attributeOldValue: false });
      target.setAttribute('flag', 'first');
      const attribute = observer.takeRecords();
      assert.equal(attribute.length, 1); assert.equal(attribute[0].type, 'attributes'); assert.equal(attribute[0].oldValue, null);
      for (const options of [{}, { attributes: false, childList: false, characterData: false },
        { childList: true, attributes: false, attributeOldValue: true },
        { childList: true, attributes: false, attributeFilter: [] },
        { childList: true, characterData: false, characterDataOldValue: true }]) {
        assert.throws(() => observer.observe(target, options), { name: 'TypeError' });
        target.setAttribute('flag', 'still observed');
        const retained = observer.takeRecords(); assert.equal(retained.length, 1); assert.equal(retained[0].target, target);
      }
      observer.observe(text, { characterDataOldValue: false });
      text.data = 'second';
      const character = observer.takeRecords();
      assert.equal(character.length, 1); assert.equal(character[0].type, 'characterData'); assert.equal(character[0].oldValue, null);
      observer.observe(target, { attributeFilter: [] });
      target.setAttribute('flag', 'filtered'); assert.equal(observer.takeRecords().length, 0);
      observer.disconnect(); target.setAttribute('flag', 'disconnected'); text.data = 'third';
      assert.equal(observer.takeRecords().length, 0);
    } finally { observer.disconnect(); dom.window.close(); }
  });

  test(`should copy iterable filters and preserve pinned namespace matching and empty filters in ${name}`, () => {
    const dom = new runtime.JSDOM('<main></main>'); const target = dom.window.document.querySelector('main');
    const observer = new dom.window.MutationObserver(() => {});
    try {
      const filter = ['flag', 'urn:\ud800'];
      observer.observe(target, { attributeFilter: filter, attributeOldValue: true }); filter.length = 0;
      target.setAttribute('flag', 'first'); target.setAttribute('ignored', 'value');
      target.setAttributeNS('urn:\ud800', 'p:other', 'old\udc00'); target.setAttributeNS('urn:\ud800', 'p:other', 'new');
      const records = observer.takeRecords();
      assert.deepEqual(records.map((record) => record.attributeName), ['flag', 'other', 'other']);
      assert.deepEqual(records.map((record) => record.attributeNamespace), [null, 'urn:\ud800', 'urn:\ud800']);
      assert.deepEqual(records.map((record) => record.oldValue), [null, null, 'old\udc00']);
      observer.observe(target, { attributeFilter: new Set(['ignored']) });
      target.setAttribute('flag', 'next'); target.setAttribute('ignored', 'included');
      const replaced = observer.takeRecords(); assert.equal(replaced.length, 1); assert.equal(replaced[0].attributeName, 'ignored');
      observer.observe(target, { attributeFilter: [] }); target.setAttribute('ignored', 'empty');
      assert.equal(observer.takeRecords().length, 0);
    } finally { observer.disconnect(); dom.window.close(); }
  });

  test(`should deduplicate registrations across ancestors and retain old values requested by any match in ${name}`, () => {
    const dom = new runtime.JSDOM('<main><section><b flag="old"></b></section></main>'); const document = dom.window.document;
    const ancestor = document.querySelector('main'); const parent = document.querySelector('section'); const target = document.querySelector('b');
    const observer = new dom.window.MutationObserver(() => {});
    try {
      observer.observe(ancestor, { attributes: true, attributeOldValue: true, subtree: true });
      observer.observe(parent, { attributes: true, subtree: false }); observer.observe(target, { attributes: true });
      target.setAttribute('flag', 'new');
      const records = observer.takeRecords(); assert.equal(records.length, 1); assert.equal(records[0].oldValue, 'old'); assert.equal(records[0].target, target);
      observer.observe(ancestor, { attributes: true, subtree: false }); target.setAttribute('flag', 'last');
      const withoutOldValue = observer.takeRecords(); assert.equal(withoutOldValue.length, 1); assert.equal(withoutOldValue[0].oldValue, null);
      observer.disconnect(); observer.observe(parent, { childList: true, subtree: true });
      target.append(document.createTextNode('child'));
      const child = observer.takeRecords(); assert.equal(child.length, 1); assert.equal(child[0].type, 'childList'); assert.equal(child[0].target, target);
    } finally { observer.disconnect(); dom.window.close(); }
  });

  test(`should deliver in creation order and preserve registrations through adoption without crossing shadow boundaries in ${name}`, async () => {
    const dom = new runtime.JSDOM('<main><section></section></main>'); const foreign = new runtime.JSDOM('<body></body>');
    const ancestor = dom.window.document.querySelector('main'); const target = dom.window.document.querySelector('section');
    const deliveries = [];
    const first = new dom.window.MutationObserver((records) => { deliveries.push(['first', records.map((record) => record.target)]); });
    const second = new dom.window.MutationObserver((records) => { deliveries.push(['second', records.map((record) => record.target)]); });
    try {
      second.observe(target, { attributes: true }); first.observe(ancestor, { attributes: true, subtree: true });
      target.setAttribute('flag', 'first'); await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(deliveries.map(([observer]) => observer), ['first', 'second']);
      assert.equal(deliveries[0][1][0], target); assert.equal(deliveries[1][1][0], target); deliveries.length = 0;
      foreign.window.document.body.append(target); target.setAttribute('flag', 'adopted');
      await new Promise((resolve) => setImmediate(resolve)); assert.deepEqual(deliveries.map(([observer]) => observer), ['second']);
      deliveries.length = 0;
      const shadow = target.attachShadow({ mode: 'closed' }); const inner = foreign.window.document.createElement('b'); shadow.append(inner);
      second.observe(target, { attributes: true, subtree: true }); inner.setAttribute('flag', 'hidden');
      assert.equal(second.takeRecords().length, 0);
      first.observe(shadow, { attributes: true, subtree: true }); inner.setAttribute('flag', 'inside');
      const inside = first.takeRecords(); assert.equal(inside.length, 1); assert.equal(inside[0].target, inner);
      assert.ok(inside[0] instanceof foreign.window.MutationRecord);
    } finally { first.disconnect(); second.disconnect(); dom.window.close(); foreign.window.close(); }
  });
}
