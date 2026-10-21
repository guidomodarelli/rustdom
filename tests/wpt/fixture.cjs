/** @file Executes the original upstream WPT loader/reporter in an isolated real runtime process. */
'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { getHeapStatistics } = require('node:v8');
const { performance } = require('node:perf_hooks');
const { TEST_TIMEOUT_MS, FIXTURE_HOST, REPORTER } = require('./constants/execution.cjs');
const root = path.resolve(__dirname, '../fixtures/wpt');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
function mediaType(file) {
  if (file.endsWith('.xhtml')) return 'application/xhtml+xml';
  if (file.endsWith('.xml')) return 'application/xml';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html';
}

/** Execute the unchanged real loader/reporter and always close its top-level realm. */
async function run(engine, file) {
  let dom;
  let timer;
  const fixtureUrl = new URL(file, `http://${FIXTURE_HOST}/`);
  const sourceFile = decodeURIComponent(fixtureUrl.pathname.slice(1));
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`WPT timeout after ${TEST_TIMEOUT_MS} ms: ${file}`)), TEST_TIMEOUT_MS);
      /** Serve completed static resources through the public ResourceLoader extension point. */
      class FixtureResources extends engine.ResourceLoader {
        /** @param {string} address - Resource URL. @returns {Promise<Buffer>} Complete static content. */
        fetch(address) {
          const url = new URL(address);
          assert.equal(url.hostname, FIXTURE_HOST, 'WPT resources must stay local');
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          const relative = path.relative(root, target);
          assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'WPT resource escaped corpus');
          const content = url.pathname === '/resources/testharnessreport.js' ? Buffer.from(REPORTER) : readFileSync(target);
          const result = Promise.resolve(content);
          result.abort = () => {}; // The synchronous read is complete; no pending resource remains.
          result.response = { headers: { 'content-type': mediaType(url.pathname) } };
          return result;
        }
      }
      const source = readFileSync(path.join(root, sourceFile));
      const scriptFixture = /\.(window|any)\.js$/.test(sourceFile);
      const scripts = scriptFixture ? [...source.toString().matchAll(/^\/\/\s*META:\s*script=(.+)$/gm)].map((match) => match[1].trim()) : [];
      const scriptTags = ['/resources/testharness.js', '/resources/testharnessreport.js', ...scripts, `/${sourceFile}`]
        .map((address) => `<script src="${address.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></script>`).join('');
      const html = scriptFixture ? `<!doctype html>${scriptTags}` : source;
      fixtureUrl.pathname = fixtureUrl.pathname.replace(/\.(window|any)\.js$/, '.$1.html');
      dom = new engine.JSDOM(html, {
        url: fixtureUrl.href,
        contentType: mediaType(sourceFile),
        runScripts: 'dangerously', resources: new FixtureResources(), pretendToBeVisual: true,
        beforeParse(window) { window.__wptDone = (json) => resolve(JSON.parse(json)); },
      });
    });
  } finally { clearTimeout(timer); dom?.window.close(); }
}

/** Validate selected bytes and preserve the original fixture timer and cleanup. */
async function runFixture(engineName, file) {
  assert.ok(['jsdom', 'rustdom'].includes(engineName), 'WPT fixture: unknown engine');
  const sourceFile = decodeURIComponent(new URL(file, `http://${FIXTURE_HOST}/`).pathname.slice(1));
  assert.ok(Object.hasOwn(manifest.files, sourceFile), `Unknown WPT fixture: ${file}`);
  const source = readFileSync(path.join(root, sourceFile));
  assert.equal(createHash('sha256').update(source).digest('hex'), manifest.files[sourceFile], `WPT fixture integrity: ${sourceFile}`);
  const engine = engineName === 'jsdom' ? require('jsdom') : require('../../dist/index.cjs');
  const started = performance.now();
  const memoryBefore = process.memoryUsage();
  const result = await run(engine, file);
  return { result, engine: engineName, file, pid: process.pid, node: process.version, v8: process.versions.v8,
    execArgv: process.execArgv, heapSizeLimitBytes: getHeapStatistics().heap_size_limit,
    durationMs: performance.now() - started, memoryBefore, memoryAfterClose: process.memoryUsage() };
}

if (require.main === module) {
  const [engine, file, output] = process.argv.slice(2);
  // Reserve the output before loading a package or running a fixture; never overwrite evidence.
  try { writeFileSync(output, '', { flag: 'wx' }); }
  catch (error) { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }
  if (!process.exitCode) runFixture(engine, file).then((report) => {
    writeFileSync(output, `${JSON.stringify(report)}\n`);
  }).catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
module.exports = { runFixture };
