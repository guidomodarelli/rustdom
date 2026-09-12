'use strict';
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const mode = process.argv[2];
const npm = '/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/npm';
const prefix = 'reports/validation/runtime-review-round4';
const node = process.execPath;
const fingerprint = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sources = spawnSync('git', ['ls-files', 'src', 'scripts', 'benchmarks', 'tests', 'types', 'Cargo.toml', 'Cargo.lock', 'package-lock.json'], { encoding: 'utf8' }).stdout.trim().split('\n');
const fingerprints = () => Object.fromEntries([...sources, 'dist/rustdom.node'].map((path) => [path, fingerprint(path)]));
const focal = [
  ['intrinsics', node, ['--test', 'tests/runtime-intrinsics.spec.cjs']],
  ['vitest', npm, ['run', 'test:vitest']],
  ['vm', npm, ['run', 'test:vm']],
];
const commands = mode === 'baseline' || mode === 'focal' ? focal : mode === 'benchmarks' ? [
  ['setup-benchmark', node, ['--expose-gc', 'benchmarks/compare.cjs', 'environment-setup', 'environment-vm-setup']],
  ['formdata-benchmark', node, ['benchmarks/formdata-realm.cjs', 'fixed']],
] : [
  ['rust-format', 'cargo', ['fmt', '--check']],
  ['rust-lint', 'cargo', ['clippy', '--all-targets', '--', '-D', 'warnings']],
  ['rust-tests', 'cargo', ['test', '--locked']],
  ['javascript-tests', npm, ['test']],
  ['html5-corpus', npm, ['run', 'test:corpus']],
  ['wpt-contracts', npm, ['run', 'test:wpt']],
  ['memory', npm, ['run', 'test:memory']],
  ['package', npm, ['run', 'package']],
  ['package-consumers', npm, ['run', 'test:package']],
];
mkdirSync(prefix, { recursive: true });
const report = { capturedAt: new Date().toISOString(), mode, node: process.version, platform: process.platform,
  head: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  base: '5a572dfdf5c3d9c62d621bcfe85922ce951841a4', drift: 'REMOTE_DRIFT_RELATED', fingerprints: fingerprints(), gates: [], pass: false };
for (const [name, command, args] of commands) {
  const startedAt = new Date().toISOString();
  process.stdout.write(`${startedAt} ${mode}: ${name}\n`);
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  writeFileSync(`${prefix}/${mode}-${name}.log`, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  report.gates.push({ name, command: command === node ? 'node' : command === npm ? 'npm' : command,
    args, startedAt, endedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, error: result.error?.message });
  writeFileSync(`${prefix}/${mode}.json`, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${name}: exit ${result.status}\n`);
  if (result.status !== 0 && mode !== 'baseline') break;
}
report.sourcesUnchanged = JSON.stringify(report.fingerprints) === JSON.stringify(fingerprints());
report.pass = report.sourcesUnchanged && report.gates.length === commands.length && report.gates.every((gate) => gate.exitCode === 0);
report.endedAt = new Date().toISOString();
writeFileSync(`${prefix}/${mode}.json`, `${JSON.stringify(report, null, 2)}\n`);
if (!report.pass && mode !== 'baseline') process.exitCode = 1;
