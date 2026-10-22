/** @file Compares every pinned reference file with actual private runtime sources, without loading either engine. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const [catalogPath, reference, packages, output] = process.argv.slice(2);
assert.ok(catalogPath && reference && packages && output, 'Pass catalog, reference, packages and a fresh output path');
const catalogBytes = fs.readFileSync(catalogPath);
const catalog = JSON.parse(catalogBytes);
const strictDirective = /^(?:(?:\s+)|(?:\/\/[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/))*["']use strict["'];/;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rows = catalog.files.map((file) => {
  const original = fs.readFileSync(path.join(reference, file.path));
  assert.equal(hash(original), file.sha256, `Runtime correspondence: changed reference ${file.path}`);
  const variants = Object.fromEntries(['A0', 'B'].map((physical) => {
    const filename = path.join(packages, physical, 'dist/vendor-jsdom', file.path);
    assert.ok(fs.existsSync(filename), filename);
    const actual = fs.readFileSync(filename);
    let expected = original;
    if (file.path.endsWith('.js')) {
      const source = original.toString('utf8');
      const offset = strictDirective.exec(source)?.[0].length || 0;
      const helper = path.relative(path.dirname(filename), path.join(packages, physical, 'dist/private-require.cjs')).split(path.sep).join('/');
      const injection = `\nrequire = require(${JSON.stringify(helper)})(require);\n`;
      expected = Buffer.from(source.slice(0, offset) + injection + source.slice(offset));
    }
    return [physical, { bytes: actual.length, sha256: hash(actual), expectedCopySha256: hash(expected),
      matchesPrivateCopyTransform: actual.equals(expected), matchesOriginalBytes: actual.equals(original) }];
  }));
  assert.equal(variants.A0.sha256, variants.B.sha256, file.path);
  return { id: file.id, path: file.path, kind: file.kind, referenceSha256: file.sha256,
    builtPath: 'dist/vendor-jsdom/' + file.path, variants, reachabilityAudited: false, classificationApplied: false };
});
const result = { catalogSha256: hash(catalogBytes), referenceVersion: catalog.package.version, sourceFiles: rows.length,
  identicalA0AndB: true, retainsReferenceTextWithOnlyRequireAdapter: rows.filter((row) => row.variants.A0.matchesPrivateCopyTransform).length,
  rewrittenByBuild: rows.filter((row) => !row.variants.A0.matchesPrivateCopyTransform).length,
  countsByKind: Object.fromEntries([...new Set(rows.map((row) => row.kind))].map((kind) => {
    const selected = rows.filter((row) => row.kind === kind);
    return [kind, { total: selected.length, retained: selected.filter((row) => row.variants.A0.matchesPrivateCopyTransform).length,
      rewritten: selected.filter((row) => !row.variants.A0.matchesPrivateCopyTransform).length }];
  })),
  classificationApplied: false, migrationCreditsAdded: 0,
  limits: 'Physical source correspondence only. Does not establish runtime reachability, complete semantic classification, lack of transitive Rust calls or a migration percentage.', rows };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ files: result.sourceFiles, retained: result.retainsReferenceTextWithOnlyRequireAdapter,
  rewritten: result.rewrittenByBuild, missing: 0, rustCredits: 0 }));
