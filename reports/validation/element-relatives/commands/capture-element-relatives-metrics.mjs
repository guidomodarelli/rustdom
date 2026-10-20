import { readFile, writeFile } from 'node:fs/promises';
const root = process.argv[2];
const lineCount = (text) => text.trimEnd().split('\n').length;
const files = ['dist/vendor-jsdom/lib/jsdom/living/nodes/ParentNode-impl.js',
  'dist/vendor-jsdom/lib/jsdom/living/nodes/NonDocumentTypeChildNode-impl.js'];
const generated = await Promise.all(files.map(async (path) => ({ path,
  beforeLines: lineCount(await readFile(`${root}/baseline-engine/${path}`, 'utf8')),
  afterLines: lineCount(await readFile(`${root}/${path}`, 'utf8')) })));
const rust = await readFile(`${root}/src/dom/element_relatives.rs`, 'utf8');
const testStart = rust.indexOf('#[cfg(test)]');
const metrics = { capturedAt: new Date().toISOString(), baselineCommit: '2ae5f2cb71a3d5da7ed58e3eb5b87b558b887a47',
  generated, nativeModule: { path: 'src/dom/element_relatives.rs', productionLines: lineCount(rust.slice(0, testStart)),
    testLines: lineCount(rust.slice(testStart)), totalLines: lineCount(rust) },
  scope: 'Physical traversal and Element filtering move to Rust using existing node-kind metadata. JavaScript retains WebIDL/factories, wrapper identity, live list ownership and invalidation; childElementCount continues to observe the existing children cache. Smaller generated modules do not imply less total implementation.' };
await writeFile(`${root}/reports/validation/element-relatives/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics));
