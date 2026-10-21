'use strict';
const fs = require('node:fs');
const worker = require('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom/reports/benchmarks/native-class-ownership/paired-worker.cjs');
const { waitForMemoryQuiescence, captureMemoryState } = require('/home/guido/rustdom-native-class-NMmiki/scripts/memory-endpoint.cjs');
const manifest = JSON.parse(fs.readFileSync('/tmp/rustdom-paired-copies-xkeEqd/manifest.json'));
function plain(runtime) {
  const dom = new runtime.api.JSDOM('<p>plain</p>');
  const references = { window: new WeakRef(dom.window), document: new WeakRef(dom.window.document) };
  dom.window.close(); return references;
}
(async () => {
  const results = [];
  for (const [label, engine] of [['J0', 'jsdom'], ['A0', 'rustdom'], ['B', 'rustdom']]) {
    const runtime = worker.loadRuntime(manifest.copies[label], engine);
    for (const mode of ['plain', 'sample']) {
      const observation = mode === 'plain' ? { weak: plain(runtime) } : worker.sample(runtime, 250);
      const references = { windows: [observation.weak.window], documents: [observation.weak.document] };
      const endpoint = await waitForMemoryQuiescence({ label: `${label}-${mode}`, sample: () => captureMemoryState(references) });
      results.push({ label, mode, reached: endpoint.reached, trace: endpoint.trace.map(({ round, clear, survivors }) => ({ round, clear, survivors })),
        native: runtime.native?.NativeRange.statistics() });
    }
  }
  process.stdout.write(`${JSON.stringify({ node: process.version, results }, null, 2)}\n`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
