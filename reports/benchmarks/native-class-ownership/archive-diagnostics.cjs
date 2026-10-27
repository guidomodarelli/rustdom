/** @file Archives complete diagnostic processes and raw profiles without copying linked workspaces. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const [profileV1, profileV2, nativeCopy] = process.argv.slice(2).map((value) => path.resolve(value));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = { schemaVersion: 1, archivedAt: new Date().toISOString(),
  archiverSha256: digest(fs.readFileSync(__filename)), files: [], studies: [] };
for (const [relativeDirectory, source, status] of [
  ['profiles/v1', profileV1, 'workers-complete; no exported timing marks; no GC-to-operation attribution'],
  ['profiles/v2', profileV2, 'workers-complete; exported marks and bounded shared-clock calibration'],
  ['native-copy', nativeCopy, 'native class-return diagnostic; separate from the public Range budget'],
]) {
  const index = JSON.parse(fs.readFileSync(path.join(source, 'index.json'), 'utf8'));
  assert.equal(index.complete, true, `Do not archive an incomplete diagnostic: ${source}`);
  assert.equal(digest(fs.readFileSync(path.join(source, 'driver.cjs'))), index.driverSha256);
  const target = path.join(__dirname, relativeDirectory);
  assert.ok(!fs.existsSync(target), `Preserve existing diagnostic archive: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  manifest.studies.push({ directory: relativeDirectory, source, status, indexDriverSha256: index.driverSha256,
    binaryIdentities: index.binaries, sourceIdentities: { A: index.sources.A.sourceHash, B: index.sources.B.sourceHash } });
  for (const entry of fs.readdirSync(source, { withFileTypes: true }).filter((entry) => entry.isFile())) {
    const bytes = fs.readFileSync(path.join(source, entry.name));
    const compressed = entry.name.endsWith('.trace.json') || entry.name.endsWith('.cpuprofile') || bytes.length > 1024 * 1024;
    const storedBytes = compressed ? gzipSync(bytes, { level: 9 }) : bytes;
    if (compressed) assert.deepEqual(gunzipSync(storedBytes), bytes);
    const storedName = `${entry.name}${compressed ? '.gz' : ''}`;
    fs.writeFileSync(path.join(target, storedName), storedBytes, { flag: 'wx' });
    manifest.files.push({ original: `${relativeDirectory}/${entry.name}`, stored: `${relativeDirectory}/${storedName}`,
      originalBytes: bytes.length, storedBytes: storedBytes.length, originalSha256: digest(bytes), storedSha256: digest(storedBytes),
      losslessRoundTripVerified: compressed ? true : null });
  }
}
const output = path.join(__dirname, 'diagnostic-evidence.json');
assert.ok(!fs.existsSync(output), 'Preserve the existing diagnostic evidence manifest');
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify({ studies: manifest.studies.length, files: manifest.files.length,
  originalBytes: manifest.files.reduce((total, entry) => total + entry.originalBytes, 0),
  storedBytes: manifest.files.reduce((total, entry) => total + entry.storedBytes, 0) })}\n`);
