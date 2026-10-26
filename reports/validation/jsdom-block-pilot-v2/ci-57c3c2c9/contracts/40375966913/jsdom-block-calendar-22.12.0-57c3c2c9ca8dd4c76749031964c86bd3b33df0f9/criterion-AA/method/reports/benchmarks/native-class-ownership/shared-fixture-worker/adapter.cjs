/** @file Hooks only fixture creation outside the timer and keeps scalar provenance, never DOM references. */
'use strict';
const assert = require('node:assert/strict');
const fixtures = require('./fixtures.cjs');
const settings = require('./constants/fixtures.json');
const counts = { mutationCreated: 0, mutationSharedMethods: 0, deliveryCreated: 0, deliverySharedMethods: 0 };

/** Preserve the original ancestor workload through its legacy factory when outside this candidate's scope. */
function mutation(document, size, ancestorDepth) {
  if (ancestorDepth !== 0) return null;
  const fixture = fixtures.createMutationFixture(document, size);
  counts.mutationCreated++;
  assert.equal(fixture.produce, fixtures.MutationFixture.prototype.produce);
  assert.equal(fixture.validate, fixtures.MutationFixture.prototype.validate);
  counts.mutationSharedMethods++;
  return fixture;
}

/** Bind the unchanged records-only delivery consumer; other legacy delivery families remain available. */
function delivery(document, size, name) {
  if (name !== settings.deliveryWorkload) return null;
  const fixture = fixtures.createDeliveryFixture(document, size, name);
  counts.deliveryCreated++;
  assert.equal(fixture.prepare, fixtures.DeliveryFixture.prototype.prepare);
  assert.equal(fixture.receive, fixtures.DeliveryFixture.prototype.receive);
  assert.equal(fixture.validate, fixtures.DeliveryFixture.prototype.validate);
  counts.deliverySharedMethods++;
  return fixture;
}

/** Return primitive counts after the real worker completes, including partial execution on failure. */
function statistics() { return { ...counts }; }
module.exports = { mutation, delivery, statistics };
