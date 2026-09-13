/** @file Executes release validation gates and preserves commands, output, and exit status. */
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { runValidationProcess } from './validation-process.mjs';

/** Resolve npm's JS entry point so validation is portable across shells. */
const npmEntry = process.env.npm_execpath;
if (!npmEntry) throw new Error('Run validation through npm run validate');
/** Every gate exercises the real toolchain or public runtime. */
const commands = [
  ['rust-format', 'cargo', ['fmt', '--check']],
  ['rust-lint', 'cargo', ['clippy', '--all-targets', '--', '-D', 'warnings']],
  ['rust-tests', 'cargo', ['test', '--locked']],
  ['build', process.execPath, [npmEntry, 'run', 'build']],
  ['javascript-tests', process.execPath, [npmEntry, 'test']],
  ['html5-corpus', process.execPath, [npmEntry, 'run', 'test:corpus']],
  ['wpt-contracts', process.execPath, [npmEntry, 'run', 'test:wpt']],
];
/** Preserve failed gates as failures with original diagnostic logs. */
const report = { capturedAt: new Date().toISOString(), node: process.version, gates: [], pass: false };
await mkdir('reports/validation', { recursive: true });
for (const [name, command, args] of commands) {
  process.stdout.write(`Validación: ${name}\n`);
  const started = performance.now();
  const { exitCode, signal, spawnError, output } = await runValidationProcess(command, args);
  await writeFile(`reports/validation/${name}.log`, output);
  report.gates.push({ name, command: command === process.execPath ? 'node' : command,
    args: args[0] === npmEntry ? ['npm-cli.js', ...args.slice(1)] : args,
    exitCode, signal, spawnError, durationMs: performance.now() - started });
  if (exitCode !== 0 || signal || spawnError) {
    process.stderr.write(`Validación ${name}: ${spawnError ? `no pudo iniciar (${spawnError.code ?? spawnError.name}): ${spawnError.message}`
      : signal ? `terminó por señal ${signal}` : `terminó con código ${exitCode}`}\n`);
    break;
  }
}
report.pass = report.gates.length === commands.length && report.gates.every((gate) => gate.exitCode === 0 && !gate.signal && !gate.spawnError);
await writeFile('reports/validation/latest.json', `${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
