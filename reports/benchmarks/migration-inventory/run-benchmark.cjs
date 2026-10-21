'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const root = '/mnt/c/Users/guido/.codex/worktrees/migration-inventory/rustdom';
const task = '/mnt/c/Users/guido/ghq/projects/rustdom';
const npm = '/home/guido/rustdom-dom-parser-final-OgiDlEeg/.tools/npm-11/node_modules/npm/bin/npm-cli.js';
const directory = root + '/reports/benchmarks/migration-inventory';
const { captureSourceIdentity } = require(root + '/benchmarks/sources.cjs');
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = { sources: captureSourceIdentity(root), audits: digest(root + '/reports/progress/inventory/audits.json'),
  packageJson: digest(root + '/package.json'), lockfile: digest(root + '/package-lock.json') };
fs.mkdirSync(directory, { recursive: true });
const report = { capturedAt: new Date().toISOString(), benchmark: 'npm run inventory -- --output TEMP: complete cold CLI',
  sourceIdentity: before, machine: { cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, arch: os.arch(), platform: os.platform(), release: os.release() },
  methodology: 'Two warmup processes and five measured fresh processes per Node. Includes npm/Node startup, reference discovery, AST parsing, public descriptor observation, classification, JSON serialization and output writes. Validate every output digest against the independently tested catalog for that Node. GNU time reports process-tree CPU and peak RSS; elapsedMs covers the full command. No other heavy task runs concurrently.',
  limits: 'Initial tooling baseline on one WSL2 machine. No before-version comparison, no DOM engine speed claim, no Rust execution and no universal leak claim.', samples: [], complete: false };
const file = directory + '/2026-10-21-cli.json';
const save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
save();
try {
  for (const executable of [task + '/.tools/node-22/bin/node', task + '/.tools/node/bin/node']) {
    const version = spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim();
    const expected = JSON.parse(fs.readFileSync(root + '/reports/validation/migration-inventory/generation-' + version + '.json')).outputDigests;
    for (let iteration = 0; iteration < 7; iteration++) {
      const output = fs.mkdtempSync('/tmp/rustdom-inventory-benchmark-');
      const resources = output + '/resources.json';
      const args = ['-o', resources, '-f', '{"peakRssKiB":%M,"userSeconds":%U,"systemSeconds":%S}', executable, npm,
        'run', 'inventory', '--', '--output', output + '/catalog'];
      const start = performance.now();
      const child = spawnSync('/usr/bin/time', args, { cwd: root, encoding: 'utf8', timeout: 30_000,
        env: { ...process.env, NODE_PATH: '/home/guido/rustdom-paired-calibration-ZXrMcC/node_modules', PATH: path.dirname(executable) + ':' + process.env.PATH } });
      const elapsedMs = performance.now() - start;
      fs.writeFileSync(output + '/stdout.log', child.stdout ?? ''); fs.writeFileSync(output + '/stderr.log', child.stderr ?? '');
      const actual = Object.fromEntries(Object.keys(expected).map((name) => [name, digest(output + '/catalog/' + name)]));
      report.samples.push({ node: version, phase: iteration < 2 ? 'warmup' : 'measured', iteration, elapsedMs,
        executable: '/usr/bin/time', args, cwd: root, exitCode: child.status, signal: child.signal, errorCode: child.error?.code ?? null,
        ...JSON.parse(fs.readFileSync(resources)), outputDigests: actual, outputVerified: JSON.stringify(actual) === JSON.stringify(expected) });
      save(); assert.equal(child.status, 0, child.stderr); assert.deepEqual(actual, expected);
    }
  }
  const after = { sources: captureSourceIdentity(root), audits: digest(root + '/reports/progress/inventory/audits.json'),
    packageJson: digest(root + '/package.json'), lockfile: digest(root + '/package-lock.json') };
  assert.deepEqual(after, before); report.identitiesUnchanged = true; report.complete = true; save();
  fs.copyFileSync(__filename, directory + '/run-benchmark.cjs');
  console.log(JSON.stringify(report.samples.filter((sample) => sample.phase === 'measured').map(({ node, elapsedMs, peakRssKiB }) => ({ node, elapsedMs, peakRssKiB })), null, 2));
} catch (error) { report.failure = { message: error.message, stack: error.stack }; save(); throw error; }
