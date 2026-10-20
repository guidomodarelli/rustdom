import { readFile, writeFile } from 'node:fs/promises';
import { cpus, release, totalmem } from 'node:os';
const root = process.argv[2];
const read = (path) => readFile(`${root}/${path}`, 'utf8');
const lineCount = (text) => text.trimEnd().split('\n').length;
const base = JSON.parse(await read('reports/validation/collection-members/baseline-metrics.json'));
const rust = await read('src/dom/collection_members.rs');
const testStart = rust.indexOf('#[cfg(test)]');
const metadata = { capturedAt: new Date().toISOString(), mainFile: base.mainFile,
  beforeMainLines: base.mainLines, afterMainLines: lineCount(await read(base.mainFile)),
  nativeModule: { path: 'src/dom/collection_members.rs', productionLines: lineCount(rust.slice(0, testStart)), testLines: lineCount(rust.slice(testStart)), totalLines: lineCount(rust) },
  scope: 'Named lookup and supported-property-name algorithms move out of the generated HTMLCollection implementation. Binding, transport and DomString/query comparison changes are separate in the diff; a smaller JavaScript file does not mean less total implementation.',
  machine: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, release: release(), totalMemoryBytes: totalmem() } };
await writeFile(`${root}/reports/validation/collection-members/metrics.json`, JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata));
