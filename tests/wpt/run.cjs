/** @file Runs pinned, unmodified WPT fixtures against jsdom and rustdom with the real WPT harness. */
'use strict';
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

/** Corpus paths and digests identify the actual upstream input, not a claim of complete WPT coverage. */
const root = path.resolve(__dirname, '../fixtures/wpt');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const engines = { jsdom: require('jsdom'), rustdom: require('../../dist/index.cjs') };
/** The pinned testharness.js enforces 10s normal and 60s for fixtures declaring timeout=long. */
const WPT_LONG_TIMEOUT_MS = 60000;
/** Cover document/resource startup as well as the full upstream long-test budget. */
const FIXTURE_STARTUP_MARGIN_MS = 30000;
/** Outer failsafe must not preempt the upstream harness; its normal/long deadlines remain unchanged. */
const TEST_TIMEOUT_MS = WPT_LONG_TIMEOUT_MS + FIXTURE_STARTUP_MARGIN_MS;
/** Virtual host shared by top-level fixtures, URL variants and the local resource loader. */
const FIXTURE_HOST = 'web-platform.test';
/** Keep the upstream assertions unchanged; replace only its browser report renderer. */
const REPORTER = 'add_completion_callback((tests, status) => __wptDone(JSON.stringify({status:status.status,message:status.message,tests:tests.map(test=>({name:test.name,status:test.status,message:test.message}))})));';

/** @param {string} file - Fixture path. @returns {string} Media type used for top-level and iframe parsing. */
function mediaType(file) {
  if (file.endsWith('.xhtml')) return 'application/xhtml+xml';
  if (file.endsWith('.xml')) return 'application/xml';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html';
}

for (const [file, expected] of Object.entries(manifest.files)) {
  assert.equal(createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'), expected,
    `WPT fixture integrity: ${file}`);
}

/**
 * Execute an upstream browser test with real DOM objects and local fixture resources.
 * @param {object} engine - Actual JSDOM implementation.
 * @param {string} file - Manifest test path.
 * @returns {Promise<object>} Harness status and all per-test results as host-realm data.
 */
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

/** @returns {Promise<void>} Saves complete observations, including shared upstream failures and any mismatch. */
async function main() {
  const requested = process.argv.slice(2);
  // Keep unsupported bootstrap paths reproducible by explicit request, without counting them as coverage.
  const blockedSuites = manifest.blockedSuites || {};
  const suites = requested.length ? requested : Object.keys(manifest.suites).filter((suite) => !blockedSuites[suite]);
  for (const suite of suites) assert.ok(manifest.suites[suite], `Unknown WPT suite: ${suite}`);
  const report = { capturedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    wptRevision: manifest.revision, jsdom: require('jsdom/package.json').version, suites,
    outerTimeoutMs: TEST_TIMEOUT_MS,
    methodology: 'Unmodified upstream assertions; local static resource loader; status, name and failure messages compared. Matching expected failures do not imply standards conformance.',
    blockedSuites, complete: Object.keys(blockedSuites).length === 0,
    results: [], pass: true };
  for (const [suite, blocker] of Object.entries(blockedSuites)) {
    process.stdout.write(`BLOQUEADO ${suite}: ${blocker.reason}; no se cuenta como cobertura aprobada.\n`);
  }
  for (const file of suites.flatMap((suite) => manifest.suites[suite])) {
    try {
      const expected = await run(engines.jsdom, file);
      const actual = await run(engines.rustdom, file);
      let pass = true;
      try {
        assert.equal(expected.status, 0); assert.equal(actual.status, 0);
        assert.ok(expected.tests.length > 0); assert.deepEqual(actual, expected);
      } catch { pass = false; }
      const standardsPass = actual.tests.filter((test) => test.status === 0).length;
      report.results.push({ file, pass, standardsPass, expected, actual });
      report.pass &&= pass;
      process.stdout.write(`${file}: ${pass ? 'PARIDAD' : 'DIFERENCIA'}, ${standardsPass}/${actual.tests.length} WPT aprobados\n`);
    } catch (error) {
      report.pass = false; report.results.push({ file, pass: false, error: error.stack });
      process.stderr.write(`${file}: ${error.message}\n`);
    }
  }
  mkdirSync('reports/compatibility', { recursive: true });
  const output = `reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-${process.platform}-wpt.json`;
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Guardado: ${output}\n`);
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
