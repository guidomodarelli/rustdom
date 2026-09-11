/** @file Creates an installable host-specific archive from the validated native build, without publishing. */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, cp, readFile, writeFile, rename, realpath, rm } from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { preserveNativeLicenses } from './native-licenses.mjs';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const native = JSON.parse(await readFile('dist/native-build.json', 'utf8'));
assert.equal(native.platform, process.platform, 'Rebuild the native addon for this packaging host');
assert.equal(native.arch, process.arch, 'Rebuild the native addon for this architecture');
const binary = await readFile('dist/rustdom.node');
assert.equal(native.binarySha256, createHash('sha256').update(binary).digest('hex'), 'Native build metadata is stale');
assert.equal(typeof require('../dist/native.cjs').parseDocumentTape, 'function');
const target = [native.platform, native.arch, native.libc].filter(Boolean).join('-');
await mkdir('.cache', { recursive: true });
await mkdir('artifacts', { recursive: true });
const staging = await mkdtemp(resolve('.cache/package-'));
for (const path of ['src/environments', 'types', 'README.md', 'LICENSE']) {
  await cp(resolve(path), join(staging, path), { recursive: true });
}
/** An explicit runtime manifest excludes stale tool transactions and binaries from other builds. */
const runtimeFiles = ['index.cjs', 'index.mjs', 'native.cjs', 'native.mjs', 'native-tree.cjs',
  'parser-bridge.cjs', 'private-require.cjs', 'data-bridge.cjs', 'native-build.json', 'rustdom.node', 'vendor-jsdom'];
await mkdir(join(staging, 'dist'), { recursive: true });
for (const name of runtimeFiles) await cp(resolve('dist', name), join(staging, 'dist', name), { recursive: true });
await preserveNativeLicenses(join(staging, 'dist/native-licenses'));
const packagedManifest = { ...manifest, os: [native.platform], cpu: [native.arch] };
if (native.libc) packagedManifest.libc = [native.libc];
delete packagedManifest.scripts;
delete packagedManifest.devDependencies;
delete packagedManifest.napi;
await writeFile(join(staging, 'package.json'), `${JSON.stringify(packagedManifest, null, 2)}\n`);
const npmEntry = process.env.npm_execpath;
if (!npmEntry) throw new Error('Create archives through npm run package');
const packed = spawnSync(process.execPath, [npmEntry, 'pack', staging, '--json', '--ignore-scripts',
  '--pack-destination', resolve('artifacts')], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
if (packed.error) throw packed.error;
if (packed.status !== 0) throw new Error(`Package creation failed: ${packed.stderr}`);
const packageInfo = JSON.parse(packed.stdout)[0];
assert.ok(packageInfo.files.some((file) => file.path === 'dist/rustdom.node'), 'Archive must contain its native binary');
const capturedAt = new Date().toISOString();
const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}-${target}-${capturedAt.replaceAll(':', '-')}.tgz`;
const archive = resolve('artifacts', filename);
await rename(resolve('artifacts', packageInfo.filename), archive);
const report = { capturedAt, target, archive, native,
  sha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
  packageInfo, staging, published: false };
await writeFile('artifacts/latest.json', `${JSON.stringify(report, null, 2)}\n`);
const actualStaging = await realpath(staging);
assert.equal(dirname(actualStaging), await realpath('.cache'));
assert.ok(basename(actualStaging).startsWith('package-'));
await rm(actualStaging, { recursive: true });
process.stdout.write(`Paquete creado: ${archive}\nSHA-256: ${report.sha256}\n`);
