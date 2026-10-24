/** Observe deterministic failed wrapping through actual exported native constructors. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const nativeModule = path.resolve(process.argv[2]), output = path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(output));
const native = require(nativeModule), range = new native.NativeRange();
const input = `<r>${'x'.repeat(4096)}</r>`, parser = new native.NativeXmlParser(input, false);
const report = { node: process.version, nativeModule, capturedAt: new Date().toISOString(), inputUnits: input.length,
  binarySha256: createHash('sha256').update(fs.readFileSync(path.join(path.dirname(nativeModule), 'rustdom.node'))).digest('hex'),
  methodology: 'Eight failed constructor calls on already-wrapped live receivers; no GC required for newly rejected Rust values.',
  before: { range: native.NativeRange.statistics(), xml: native.NativeXmlParser.statistics() }, attempts: [] };
for (let attempt = 0; attempt < 8; attempt++) {
  const errors = [];
  for (const [constructor, receiver, args] of [[native.NativeRange, range, []], [native.NativeXmlParser, parser, [input, false]]]) {
    try { Reflect.apply(constructor, receiver, args); assert.fail('Expected failed wrap on a receiver already owned by N-API'); }
    catch (error) { assert.match(error.message, /Failed to initialize class/); errors.push({ name: error.name, message: error.message }); }
  }
  report.attempts.push({ attempt, errors, range: native.NativeRange.statistics(), xml: native.NativeXmlParser.statistics() });
}
report.after = { range: native.NativeRange.statistics(), xml: native.NativeXmlParser.statistics() };
report.retainedRanges = report.after.range.live - report.before.range.live;
report.retainedParsers = report.after.xml.live - report.before.xml.live;
report.retainedInputUnits = report.after.xml.inputUnits - report.before.xml.inputUnits;
report.originalRangeUsable = range.copy() instanceof native.NativeRange;
report.originalParserEvent = parser.next().kind;
parser.close();
report.complete = true;
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ node: report.node, retainedRanges: report.retainedRanges, retainedParsers: report.retainedParsers,
  retainedInputUnits: report.retainedInputUnits, output }));
