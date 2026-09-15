/** @file Verifies another native addon's instance data in both real load orders. */
'use strict';
const assert = require('node:assert/strict');
const [order, nativePath, otherPath] = process.argv.slice(2);
let native, other;
if (order === 'other-first') { other = require(otherPath); assert.deepEqual(other.check(), {ownsSlot:true,token:12345}); native = require(nativePath); }
else { native = require(nativePath); other = require(otherPath); }
assert.deepEqual(other.check(), {ownsSlot:true,token:12345});
const results = [];
for (let token = 1; token <= 25; token++) {
  assert.deepEqual(other.replace(token), {ownsSlot:true,token});
  const value = native.serializeXml({nodeType:11,childNodes:[{nodeType:3,data:'value-'+token}]}, false);
  assert.equal(value, 'value-'+token);
  const invalid = {nodeType:11,childNodes:{[Symbol.iterator]() { return {next() { return Symbol('probe'); }}; }}};
  assert.throws(() => native.serializeXml(invalid, false), {name:'TypeError',message:'Iterator result Symbol(probe) is not an object'});
  assert.deepEqual(other.check(), {ownsSlot:true,token});
  const statistics = native.xmlSerializationStatistics();
  assert.equal(statistics.live, 0); assert.equal(statistics.references, 0); assert.equal(statistics.cleanupErrors, 0);
  results.push({token,value,ownsSlot:true});
}
process.stdout.write(JSON.stringify({node:process.version,order,cycles:25,pass:true,results})+'\n');
