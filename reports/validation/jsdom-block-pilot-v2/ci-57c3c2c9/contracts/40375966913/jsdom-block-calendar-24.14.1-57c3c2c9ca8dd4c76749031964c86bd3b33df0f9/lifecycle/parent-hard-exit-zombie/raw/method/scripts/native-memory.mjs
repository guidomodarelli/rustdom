/** @file Runs real Rust unit tests under Valgrind and preserves complete native memory diagnostics. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { NATIVE_MEMORY_TESTS_PER_RUN, planNativeMemoryRuns, completedNativeMemoryRun } from './native-memory-plan.mjs';

/** Preserve the existing per-process memory watchdog while bounding cumulative test cost. */
const NATIVE_MEMORY_RUN_TIMEOUT_MS = 600_000;

if (process.platform !== 'linux') throw new Error('Native memory analysis requires Linux and Valgrind');
/** Project-local installations avoid changing the host when a system installation is unavailable. */
const localExecutable = resolve('.tools/valgrind/usr/bin/valgrind');
const valgrind = process.env.RUSTDOM_VALGRIND || (existsSync(localExecutable) ? localExecutable : 'valgrind');
const environment = valgrind === localExecutable
  ? { ...process.env, VALGRIND_LIB: resolve('.tools/valgrind/usr/libexec/valgrind') } : process.env;
const compile = spawnSync('cargo', ['test', '--no-run', '--locked', '--message-format=json'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
if (compile.error) throw compile.error;
if (compile.status !== 0) throw new Error(`Native memory test compilation failed: ${compile.stderr}`);
const executables = compile.stdout.trim().split('\n').map((line) => JSON.parse(line))
  .filter((artifact) => artifact.profile?.test && artifact.executable).map((artifact) => artifact.executable);
if (!executables.length) throw new Error('Native memory analysis found no Rust test executables');

const capturedAt = new Date().toISOString();
const prefix = `reports/memory/${capturedAt.replaceAll(':', '-')}-valgrind`;
mkdirSync('reports/memory', { recursive: true });
const version = spawnSync(valgrind, ['--version'], { encoding: 'utf8', env: environment });
if (version.error) throw version.error;
const report = { capturedAt, version: version.stdout.trim(),
  methodology: 'Every real Rust test under Memcheck in exhaustive bounded exact-name batches, full leak reporting, origin tracking, one test thread; invalid accesses, incomplete tests and definite/indirect leaks fail the command.',
  testsPerRun: NATIVE_MEMORY_TESTS_PER_RUN, timeoutMs: NATIVE_MEMORY_RUN_TIMEOUT_MS,
  limitations: 'Covers the Rust test executable, not V8 or the loaded Node-API addon. Possible leaks and reachable allocations remain visible in the raw log for review.',
  cargoLockSha256: createHash('sha256').update(readFileSync('Cargo.lock')).digest('hex'), runs: [], pass: false };
/** @returns {void} Keep completed diagnostics available if a later batch is interrupted. */
function saveReport() { writeFileSync(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`); }
saveReport();
for (const [index, executable] of executables.entries()) {
  const inventory = spawnSync(executable, ['--list', '--format=terse', '--test'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (inventory.error) throw inventory.error;
  if (inventory.status !== 0) throw new Error(`Native memory test inventory failed for ${executable}: ${inventory.stderr}`);
  writeFileSync(`${prefix}-${index}-inventory.log`, inventory.stdout);
  const batches = planNativeMemoryRuns(inventory.stdout);
  const executableSha256 = createHash('sha256').update(readFileSync(executable)).digest('hex');
  for (const [batchIndex, tests] of batches.entries()) {
    const logPath = `${prefix}-${index}-${batchIndex}.log`;
    const args = ['--tool=memcheck', '--leak-check=full', '--show-leak-kinds=all',
      '--errors-for-leak-kinds=definite,indirect', '--track-origins=yes', '--error-exitcode=99',
      `--log-file=${logPath}`, executable, '--test-threads=1', '--exact', '--test', ...tests];
    process.stderr.write(`Valgrind: ${executable}, batch ${batchIndex + 1}/${batches.length}, ${tests.length} tests\n`);
    const started = performance.now();
    const child = spawnSync(valgrind, args, { env: environment, encoding: 'utf8', timeout: NATIVE_MEMORY_RUN_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(`${prefix}-${index}-${batchIndex}-tests.log`, child.stdout || '');
    process.stdout.write(child.stdout || '');
    process.stderr.write(child.stderr || '');
    report.runs.push({ executable, executableSha256, batchIndex, tests,
      testsCompleted: completedNativeMemoryRun(child.stdout || '', tests.length), durationMs: performance.now() - started,
      args, logPath, exitCode: child.status, signal: child.signal, error: child.error?.message });
    saveReport();
  }
}
report.pass = report.runs.every((run) => run.exitCode === 0 && !run.error && !run.signal && run.testsCompleted);
saveReport();
process.stdout.write(`Guardado: ${prefix}.json\n`);
if (!report.pass) process.exitCode = 1;
