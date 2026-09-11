/** @file Builds the native library with Cargo and installs the host artifact without CLI filesystem transactions. */
import { spawnSync } from 'node:child_process';
import { mkdir, copyFile } from 'node:fs/promises';

/** Ask Cargo for the actual artifact path instead of guessing platform suffixes or target directories. */
const result = spawnSync('cargo', ['build', '--release', '--locked', '--message-format=json-render-diagnostics'], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'],
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`rustdom build: cargo exited with status ${result.status}`);

/** Cargo emits structured artifact messages alongside diagnostics. */
const artifacts = result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
/** Select this package's dynamic library, excluding debug symbols and dependencies. */
const artifact = artifacts.findLast((entry) => entry.reason === 'compiler-artifact' &&
  entry.target.name === 'rustdom' && entry.target.crate_types.includes('cdylib'));
const library = artifact?.filenames.find((filename) => /\.(so|dylib|dll)$/.test(filename));
if (!library) throw new Error('rustdom build: Cargo did not report the rustdom native library artifact');
await mkdir('dist', { recursive: true });
await copyFile(library, 'dist/rustdom.node');
await copyFile('src/native.cjs', 'dist/native.cjs');
