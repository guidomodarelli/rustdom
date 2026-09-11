/** @file Runs real Rust unit tests under Valgrind and preserves complete native memory diagnostics. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
  methodology: 'Real Rust tests under Memcheck, full leak reporting, origin tracking, one test thread; invalid accesses and definite/indirect leaks fail the command.',
  limitations: 'Covers the Rust test executable, not V8 or the loaded Node-API addon. Possible leaks and reachable allocations remain visible in the raw log for review.',
  cargoLockSha256: createHash('sha256').update(readFileSync('Cargo.lock')).digest('hex'), runs: [], pass: false };
for (const [index, executable] of executables.entries()) {
  const logPath = `${prefix}-${index}.log`;
  const args = ['--tool=memcheck', '--leak-check=full', '--show-leak-kinds=all',
    '--errors-for-leak-kinds=definite,indirect', '--track-origins=yes', '--error-exitcode=99',
    `--log-file=${logPath}`, executable, '--test-threads=1'];
  process.stderr.write(`Valgrind: ${executable}\n`);
  const child = spawnSync(valgrind, args, { env: environment, encoding: 'utf8', timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(`${prefix}-${index}-tests.log`, child.stdout || '');
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  report.runs.push({ executable, executableSha256: createHash('sha256').update(readFileSync(executable)).digest('hex'),
    args, logPath, exitCode: child.status, signal: child.signal, error: child.error?.message });
}
report.pass = report.runs.every((run) => run.exitCode === 0 && !run.error);
writeFileSync(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Guardado: ${prefix}.json\n`);
if (!report.pass) process.exitCode = 1;
