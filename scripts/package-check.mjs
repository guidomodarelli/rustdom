/** @file Installs the archive outside the checkout and runs typed consumers plus actual test runners. */
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, cp, mkdir, rm, realpath } from 'node:fs/promises';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const root = resolve('.');
const artifact = JSON.parse(await readFile(process.argv[2] || 'artifacts/latest.json', 'utf8'));
assert.equal(createHash('sha256').update(await readFile(artifact.archive)).digest('hex'), artifact.sha256);
const dependencies = { '@rustdom/rustdom': pathToFileURL(artifact.archive).href };
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
for (const name of ['@types/node', '@jest/environment-jsdom-abstract', '@testing-library/react', '@testing-library/user-event',
  'jest', 'vitest', 'react', 'react-dom', 'typescript']) {
  dependencies[name] = lock.packages[`node_modules/${name}`].version;
}
const report = { capturedAt: new Date().toISOString(), artifact, node: process.version, dependencies,
  pass: false, runs: [] };
await mkdir('reports/distribution', { recursive: true });
const prefix = `reports/distribution/${report.capturedAt.replaceAll(':', '-')}-${process.platform}-${process.arch}`;
const npmEntry = process.env.npm_execpath;
if (!npmEntry) throw new Error('Run package checks through npm run test:package');
const pnpmManifestPath = require.resolve('pnpm/package.json');
// pnpm 12 exposes a native bin and this explicit Node/Corepack wrapper.
const pnpmEntry = resolve(dirname(pnpmManifestPath), 'bin/pnpm.mjs');

/** @param {string} name - Gate name. @param {string[]} args - Node CLI arguments. @param {string} cwd - Isolated consumer. @returns {void} Records failures before raising them. */
function run(name, args, cwd) {
  process.stderr.write(`Paquete: ${name}\n`);
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024, timeout: 600_000 });
  report.runs.push({ name, args, cwd, exitCode: result.status, durationMs: performance.now() - started, signal: result.signal,
    error: result.error?.message, stdout: result.stdout, stderr: result.stderr });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed (${result.status}): ${result.stderr}\n${result.stdout}`);
}

try {
  // Windows TEMP may contain an 8.3 alias; Vite resolves real paths when importing test files.
  const temporaryRoot = await realpath(tmpdir());
  for (const manager of ['npm', 'pnpm']) {
    const directory = await realpath(await mkdtemp(join(temporaryRoot, 'rustdom-consumer-')));
    await writeFile(join(directory, 'package.json'), `${JSON.stringify({ name: 'rustdom-consumer', private: true, dependencies }, null, 2)}\n`);
    await cp('tests/integration', join(directory, 'tests/integration'), { recursive: true });
    await cp('tests/distribution', join(directory, 'types'), { recursive: true });
    for (const config of ['jest.config.cjs', 'vitest.config.mjs', 'vitest.vm.config.mjs']) {
      const original = await readFile(config, 'utf8');
      const source = config.endsWith('.cjs')
        ? original.replace('<rootDir>/src/environments/jest.cjs', '@rustdom/rustdom/jest')
        : "import { fileURLToPath } from 'node:url';\n" + original.replaceAll("'./src/environments/vitest.mjs'",
          "fileURLToPath(import.meta.resolve('@rustdom/rustdom/vitest'))");
      await writeFile(join(directory, config), source);
    }
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      esModuleInterop: true, skipLibCheck: false, outDir: 'compiled', types: ['node'],
    }, include: ['types/*'] }));
    const installArgs = manager === 'npm'
      ? [npmEntry, 'install', '--ignore-scripts', '--no-audit', '--cache', join(root, '.cache/npm-linux')]
      : [pnpmEntry, 'install', '--ignore-scripts', '--store-dir', join(root, '.cache/pnpm-store')];
    run(`${manager}-install`, installArgs, directory);
    await cp(join(directory, manager === 'npm' ? 'package-lock.json' : 'pnpm-lock.yaml'), `${prefix}-${manager}-lock${manager === 'npm' ? '.json' : '.yaml'}`);
    const consumerRequire = createRequire(join(directory, 'package.json'));
    /** @param {string} name - Installed package name. @param {string} executable - Declared bin name. @returns {string} Absolute CLI path. */
    const packageBin = (name, executable) => {
      const path = consumerRequire.resolve(`${name}/package.json`);
      const manifest = consumerRequire(path);
      return resolve(dirname(path), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[executable]);
    };
    run(`${manager}-types`, [packageBin('typescript', 'tsc')], directory);
    run(`${manager}-commonjs`, [join(directory, 'compiled/consumer.cjs')], directory);
    run(`${manager}-esm-vm`, [join(directory, 'compiled/consumer.mjs')], directory);
    run(`${manager}-worker-assets`, [join(directory, 'compiled/worker-assets.mjs')], directory);
    run(`${manager}-jest`, [packageBin('jest', 'jest'), '--runInBand'], directory);
    run(`${manager}-vitest`, [packageBin('vitest', 'vitest'), 'run'], directory);
    run(`${manager}-vitest-vm`, [packageBin('vitest', 'vitest'), 'run', '--config', 'vitest.vm.config.mjs'], directory);
    // Delete only the verified temporary consumer created by this invocation.
    const actual = await realpath(directory);
    assert.equal(dirname(actual), await realpath(tmpdir()));
    assert.ok(basename(actual).startsWith('rustdom-consumer-'));
    await rm(actual, { recursive: true });
  }
  report.pass = true;
} finally {
  await writeFile(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Guardado: ${prefix}.json\n`);
}
