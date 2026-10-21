/** @file Validates inventory coverage against real public descriptors, provenance and owner release. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { buildInventory, writeInventory } = require('../../scripts/migration-inventory.cjs');
const { INVENTORY_MEMORY_TIMEOUT_MS, INVENTORY_CLI_TIMEOUT_MS } = require('../../scripts/constants/migration-inventory.cjs');
const referenceRoot = dirname(require.resolve('jsdom/package.json'));
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { JSDOM } = require('jsdom');
let inventory;
before(() => { inventory = buildInventory({ referenceRoot, repositoryRoot }); });

/** @param {string} directory - This test's mkdtemp result. @returns {void} Removes only verified inventory fixture directories. */
function removeTemporaryDirectory(directory) {
  const target = realpathSync(directory);
  assert.equal(dirname(target), realpathSync(tmpdir())); assert.ok(basename(target).startsWith('rustdom-inventory-'));
  rmSync(target, { recursive: true, force: true });
}

test('should capture real methods, unforgeable accessors, inheritance and constructor-only interfaces', () => {
  const dom = new JSDOM('', { url: 'https://inventory.example/path' });
  try {
    const clone = inventory.surface.apis.find((entry) => entry.id === 'api:Window.Node.prototype.cloneNode');
    assert.equal(clone.arity, dom.window.Node.prototype.cloneNode.length);
    const element = dom.window.document.createElement('div'); element.setAttribute('data-value', 'retained');
    assert.equal(element.cloneNode().getAttribute('data-value'), 'retained');
    const href = inventory.surface.apis.find((entry) => entry.id === 'api:Location.instance.href');
    assert.equal(href.get, true); assert.equal(href.set, true);
    assert.equal(dom.window.location.href, 'https://inventory.example/path');
    assert.equal(href.configurable, Object.getOwnPropertyDescriptor(dom.window.location, 'href').configurable);
    assert.ok(inventory.surface.constructors.some((entry) => entry.name === 'Window.HTMLUnknownElement'));
    assert.ok(inventory.surface.apis.some((entry) => entry.id === 'api:Window.HTMLUnknownElement'));
    assert.ok(inventory.surface.apis.some((entry) => entry.id === 'api:Window.setTimeout'));
  } finally { dom.window.close(); }
});

test('should include jsdom exports and external URL and cookie contracts without expanding ECMAScript globals', async () => {
  for (const id of ['api:jsdom.JSDOM.static.fromURL', 'api:jsdom.ResourceLoader.prototype.fetch',
    'api:jsdom.toughCookie.CookieJar.prototype.setCookie', 'api:Window.URL.prototype.href']) {
    assert.ok(inventory.surface.apis.some((entry) => entry.id === id), id);
  }
  assert.equal(inventory.surface.apis.some((entry) => entry.id === 'api:Window.Array'), false);
  assert.ok(inventory.surface.exclusions.some((entry) => entry.name === 'Array' && entry.reason === 'ecmascript-host-global'));
  const jar = new (require('jsdom').toughCookie.CookieJar)();
  await jar.setCookie('session=inventory; Path=/', 'https://inventory.example/');
  assert.equal(await jar.getCookieString('https://inventory.example/'), 'session=inventory');
});

test('should keep a closed reference graph for internal dependencies and explicit anchors for every discovered callable', () => {
  const ids = new Set(inventory.reference.files.map((entry) => entry.id));
  for (const file of inventory.reference.files) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    for (const dependency of file.dependencies.filter((entry) => entry.kind === 'internal')) assert.ok(ids.has(`module:${dependency.target}`), dependency.target);
  }
  assert.ok(inventory.units.some((entry) => entry.moduleId.endsWith('/Location.js') && entry.name === 'href' && entry.kind === 'GetAccessor'));
  for (const unit of inventory.units) { assert.ok(ids.has(unit.moduleId)); assert.ok(unit.line > 0 && unit.column > 0); }
  assert.equal(inventory.summary.scopeClosed, false); assert.equal(inventory.summary.migrationPercent, null);
});

test('should validate authored audit evidence and reject stale IDs or unsupported completion claims', () => {
  const audits = JSON.parse(readFileSync(join(repositoryRoot, 'reports/progress/inventory/audits.json')));
  const audited = buildInventory({ referenceRoot, repositoryRoot, audits });
  assert.equal(audited.summary.counts.files.states.hybrid, 2);
  assert.throws(() => buildInventory({ referenceRoot, repositoryRoot, audits: { 'module:missing': {} } }), /Unknown inventory audit ID/);
  const node = audits['module:lib/jsdom/living/nodes/Node-impl.js'];
  assert.throws(() => buildInventory({ referenceRoot, repositoryRoot,
    audits: { 'module:lib/jsdom/living/nodes/Node-impl.js': { ...node, status: 'rust-complete' } } }), /retains pending work/);
});

test('should reproduce byte-identical catalog outputs without mixing timestamps or absolute machine paths', () => {
  const firstDirectory = mkdtempSync(join(tmpdir(), 'rustdom-inventory-first-'));
  const secondDirectory = mkdtempSync(join(tmpdir(), 'rustdom-inventory-second-'));
  try {
    const first = writeInventory(inventory, firstDirectory);
    const second = writeInventory(buildInventory({ referenceRoot, repositoryRoot }), secondDirectory);
    assert.deepEqual(first, second);
  } finally { removeTemporaryDirectory(firstDirectory); removeTemporaryDirectory(secondDirectory); }
});

test('should preserve real CLI ordinal order and match across supported host locales', (context) => {
  const results = [];
  for (const locale of ['en_US.UTF-8', 'tr_TR.UTF-8']) {
    const directory = mkdtempSync(join(tmpdir(), 'rustdom-inventory-locale-'));
    const env = { ...process.env, LANG: locale, LC_ALL: locale };
    try {
      const observed = spawnSync(process.execPath, ['-p', 'new Intl.Collator().resolvedOptions().locale'], { encoding: 'utf8', env });
      assert.equal(observed.status, 0);
      if (process.platform === 'win32') context.diagnostic(`Windows conserva el locale ICU del usuario (${observed.stdout.trim()}); se verifica el orden ordinal sin cambiarlo.`);
      else assert.ok(observed.stdout.trim().startsWith(locale.slice(0, 2)), observed.stdout);
      const child = spawnSync(process.execPath, [join(repositoryRoot, 'scripts/migration-inventory.cjs'), '--output', directory],
        { encoding: 'utf8', env, timeout: INVENTORY_CLI_TIMEOUT_MS });
      assert.equal(child.status, 0, child.stderr); results.push(JSON.parse(child.stdout).outputDigests);
      const surface = JSON.parse(readFileSync(join(directory, 'surface.json'), 'utf8'));
      const ids = surface.apis.map((entry) => entry.id), names = surface.constructors.map((entry) => entry.name);
      assert.deepEqual(ids, ids.toSorted()); assert.deepEqual(names, names.toSorted());
    } finally { removeTemporaryDirectory(directory); }
  }
  assert.deepEqual(results[0], results[1]);
});

test('should release Window and Document while retaining complete scalar surface reports', () => {
  const result = spawnSync(process.execPath, ['--expose-gc', join(repositoryRoot, 'tests/helpers/inventory-memory.cjs')],
    { encoding: 'utf8', env: process.env, timeout: INVENTORY_MEMORY_TIMEOUT_MS });
  assert.equal(result.status, 0, result.stderr);
  const memory = JSON.parse(result.stdout);
  assert.equal(memory.cycles, 3); assert.equal(memory.reportsRetained, 3);
  assert.equal(memory.released, true); assert.deepEqual(memory.survivors, { windows: 0, documents: 0 });
});
