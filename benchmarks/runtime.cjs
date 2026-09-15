/** @file Selects the actual rustdom package for reproducible workspace or historical-package benchmarks. */
'use strict';
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
/** An explicit package root allows historical comparisons without replacing the live workspace addon. */
const runtimeRoot = process.env.RUSTDOM_BENCHMARK_PACKAGE ? resolve(process.env.RUSTDOM_BENCHMARK_PACKAGE) : resolve(__dirname, '..');
const runtimeEntry = resolve(runtimeRoot, 'dist/index.cjs');
const nativeBinaryPath = resolve(runtimeRoot, 'dist/rustdom.node');
const environmentEntry = pathToFileURL(resolve(runtimeRoot, 'src/environments/vitest.mjs')).href;
module.exports = { runtimeRoot, runtimeEntry, nativeBinaryPath, environmentEntry };
