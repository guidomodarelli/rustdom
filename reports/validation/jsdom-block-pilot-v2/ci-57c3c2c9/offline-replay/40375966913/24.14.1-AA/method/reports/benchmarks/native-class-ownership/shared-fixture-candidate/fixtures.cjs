/** @file Prospective ownership fixtures with shared consumer methods and untouched measured nodes. */
'use strict';
const assert = require('node:assert/strict');
const settings = require('./constants/fixtures.json');

/** Keep misuse after teardown explicit while allowing disposal to be repeated. */
function assertActive(fixture, operation) {
  if (fixture.disposed) throw new Error(`${fixture.constructor.name}.${operation} failed: ${settings.disposedReason}`);
}

/** Consume the same public MutationRecord fields as the frozen ownership workload. */
function captureRecords(records) {
  return records.map((record) => ({ type: record.type, target: record.target, attributeName: record.attributeName,
    attributeNamespace: record.attributeNamespace, oldValue: record.oldValue, previousSibling: record.previousSibling,
    nextSibling: record.nextSibling, added: [...record.addedNodes], removed: [...record.removedNodes] }));
}

/** Empty delivery remains a module function, with no closure retaining a fixture. */
function ignoreDelivery() {}

/** A fresh public mutation fixture whose consumers have identity shared across warmup and measurement. */
class MutationFixture {
  constructor(document, size) {
    this.disposed = false;
    this.size = size;
    this.host = document.body.appendChild(document.createElement('section'));
    this.text = this.host.appendChild(document.createTextNode(settings.initialText));
    this.children = Array.from({ length: size }, () => document.createElement('b'));
    this.observer = new document.defaultView.MutationObserver(ignoreDelivery);
    this.observer.observe(this.host, settings.mutationObserverOptions);
    this.records = [];
    this.expectedRecords = size * 3;
    this.expectedNativePayloads = size * 3;
  }

  /** Run the original attribute/text/append sequence exactly once on this fresh state. */
  produce() {
    assertActive(this, 'produce');
    for (let index = 0; index < this.size; index++) {
      this.host.setAttribute(settings.mutationAttribute, String(index));
      this.text.data = `${settings.textValuePrefix}${index}`;
      this.host.append(this.children[index]);
    }
    return this.observer.takeRecords();
  }

  /** Check every consumed field and original node identity outside measurement. */
  validate(snapshots) {
    assertActive(this, 'validate');
    assert.equal(snapshots.length, this.expectedRecords);
    for (let index = 0; index < this.size; index++) {
      const common = { attributeNamespace: null, nextSibling: null, removed: [] };
      assert.deepEqual(snapshots[index * 3], { ...common, type: 'attributes', target: this.host,
        attributeName: settings.mutationAttribute, oldValue: index ? String(index - 1) : null, previousSibling: null, added: [] });
      assert.deepEqual(snapshots[index * 3 + 1], { ...common, type: 'characterData', target: this.text,
        attributeName: null, oldValue: index ? `${settings.textValuePrefix}${index - 1}` : settings.initialText,
        previousSibling: null, added: [] });
      assert.deepEqual(snapshots[index * 3 + 2], { ...common, type: 'childList', target: this.host,
        attributeName: null, oldValue: null, previousSibling: index ? this.children[index - 1] : this.text,
        added: [this.children[index]] });
    }
  }

  /** Disconnect and release strong node references, including when validation has failed. */
  dispose() {
    if (this.disposed) return;
    this.observer.disconnect();
    this.host.remove();
    this.records = [];
    this.children.length = 0;
    this.observer = this.host = this.text = null;
    this.disposed = true;
  }
}

/** Original records-only delivery workload, keeping shared JS method bodies across separate fixtures. */
class DeliveryFixture {
  constructor(document, size) {
    this.disposed = false;
    this.size = size;
    this.host = document.body.appendChild(document.createElement('section'));
    this.received = [];
    this.observerCalls = 0;
    this.completed = new Promise((resolve) => { this.resolveDelivery = resolve; });
    this.observers = Array.from({ length: size }, (unused, index) => {
      const observer = new document.defaultView.MutationObserver(this.receive.bind(this, index));
      observer.observe(this.host, settings.deliveryObserverOptions);
      return observer;
    });
  }

  /** Bound callbacks share this target body; each retains only its own fixture until disposal. */
  receive(index, records) {
    if (this.disposed) return;
    this.received[index] = records;
    this.observerCalls++;
    if (this.observerCalls === this.size) this.resolveDelivery();
  }

  /** Queue the same single public mutation before awaiting actual observer delivery. */
  prepare() {
    assertActive(this, 'prepare');
    this.host.setAttribute(settings.deliveryAttribute, settings.deliveryValue);
  }

  /** Check every observer, record field and target identity after callbacks complete. */
  validate() {
    assertActive(this, 'validate');
    assert.equal(this.observerCalls, this.size);
    for (let index = 0; index < this.size; index++) {
      assert.equal(this.received[index].length, 1);
      const record = this.received[index][0];
      assert.equal(record.type, 'attributes'); assert.equal(record.target, this.host);
      assert.equal(record.attributeName, settings.deliveryAttribute); assert.equal(record.attributeNamespace, null);
      assert.equal(record.oldValue, null); assert.equal(record.previousSibling, null); assert.equal(record.nextSibling, null);
      assert.equal(record.addedNodes.length, 0); assert.equal(record.removedNodes.length, 0);
    }
  }

  /** Disconnect all registrations and drop record, promise and node references. */
  dispose() {
    if (this.disposed) return;
    for (const observer of this.observers) observer.disconnect();
    this.host.remove();
    this.received.length = 0;
    this.observers.length = 0;
    this.resolveDelivery = this.completed = this.host = null;
    this.disposed = true;
  }
}

/** Adapter for the existing same-realm warmup helper; measured and temporary nodes remain distinct. */
function createMutationFixture(document, size) { return new MutationFixture(document, size); }

/** This prospective adapter covers the records-only workload of the eight-row ownership matrix. */
function createDeliveryFixture(document, size, name) {
  assert.equal(name, settings.deliveryWorkload, 'Shared delivery fixture: unsupported ownership workload');
  return new DeliveryFixture(document, size);
}

module.exports = { MutationFixture, DeliveryFixture, captureRecords, createMutationFixture, createDeliveryFixture };
