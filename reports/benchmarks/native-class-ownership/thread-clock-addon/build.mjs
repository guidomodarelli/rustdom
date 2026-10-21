/** @file Builds the diagnostic clock independently; never replaces a rustdom distribution. */
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
if (process.platform !== 'linux') throw new Error('The diagnostic CPU clock requires Linux');
const root = dirname(fileURLToPath(import.meta.url));
const result = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', join(root, 'Cargo.toml')], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
copyFileSync(join(process.env.CARGO_TARGET_DIR || join(root, 'target'), 'release/librustdom_native_thread_clock.so'), join(root, 'thread-clock.node'));
