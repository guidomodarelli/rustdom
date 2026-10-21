'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const task = '/mnt/c/Users/guido/ghq/projects/rustdom', root = process.cwd();
const warmupBatches = Number(process.argv[2] ?? 16);
assert.ok(Number.isSafeInteger(warmupBatches) && warmupBatches > 0);
const baseline = fs.realpathSync('/home/guido/rustdom-element-collection-ffhkkq/baseline-engine');
const directory = path.join(root, 'reports/benchmarks/xml-serializer-controller/diagnostics/gc-jit-' + new Date().toISOString().replaceAll(':', '-'));
fs.mkdirSync(directory, { recursive: true });
const report = { capturedAt: new Date().toISOString(), cpu: os.cpus()[0].model, platform: os.platform(), release: os.release(),
  affinity: 2, warmupBatches, baseline, completionScope: 'Diagnostic of the unchanged baseline; not A/A or A/B acceptance', runs: [], complete: false };
const probe = task + '/.cache/xml-controller-gc-probe.cjs';
fs.copyFileSync(probe, directory + '/probe.cjs'); fs.copyFileSync(__filename, directory + '/run.cjs');
report.probeSha256 = createHash('sha256').update(fs.readFileSync(probe)).digest('hex');
const save = () => fs.writeFileSync(directory + '/index.json', JSON.stringify(report, null, 2) + '\n');
try {
  save();
  for (const executable of [task + '/.tools/node-22/bin/node', task + '/.tools/node/bin/node']) {
    const version = spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim();
    for (const row of ['xml-serialize/1', 'xml-serializer-getter-error/1']) {
      for (let repetition = 0; repetition < 5; repetition++) {
        const traced = repetition === 4, label = `${version}-${row.replace('/', '-')}-${repetition}`;
        const args = ['-c', '2', executable, '--expose-gc', ...(traced ? ['--trace-gc-nvp', '--trace-opt', '--trace-deopt', '--trace-file-names'] : []),
          probe, row, directory + '/' + label + '.json', traced ? 'trace' : 'observe', String(warmupBatches)];
        const result = spawnSync('taskset', args, { cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
          env: { ...process.env, RUSTDOM_BENCHMARK_PACKAGE: baseline } });
        fs.writeFileSync(directory + '/' + label + '.stdout.log', result.stdout || '');
        fs.writeFileSync(directory + '/' + label + '.stderr.log', result.stderr || '');
        report.runs.push({ label, version, row, traced, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null }); save();
        assert.equal(result.status, 0, result.error?.message ?? result.stderr);
        process.stderr.write(`${label}: diagnostic completed\n`);
      }
    }
  }
  report.complete = true; save(); process.stdout.write(directory + '\n');
} catch (error) { report.failure = error.message; save(); throw error; }
