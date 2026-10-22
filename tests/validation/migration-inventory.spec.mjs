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

test('should capture non-exported inherited EventEmitter declarations and exercise their real public contracts', async () => {
  const { VirtualConsole } = require('jsdom');
  const console = new VirtualConsole();
  const inherited = inventory.surface.apis.filter((entry) => entry.inheritance?.receiver === 'jsdom.VirtualConsole');
  const listen = inherited.find((entry) => entry.inheritance.side === 'instance' && entry.name === 'on');
  assert.ok(listen);
  assert.equal(listen.arity, VirtualConsole.prototype.on.length);
  assert.equal(listen.inheritance.constructorName, 'EventEmitter');
  const observed = [];
  const listener = (message) => observed.push(message);
  console.on('warn', listener); console.emit('warn', 'inventory'); console.off('warn', listener);
  assert.deepEqual(observed, ['inventory']); assert.equal(console.listenerCount('warn'), 0);
  const once = inherited.find((entry) => entry.inheritance.side === 'constructor' && entry.name === 'once');
  assert.ok(once); assert.equal(once.arity, VirtualConsole.once.length);
  const pending = VirtualConsole.once(console, 'inventory-complete');
  console.emit('inventory-complete', 'released');
  assert.deepEqual(await pending, ['released']);
  assert.equal(console.listenerCount('inventory-complete'), 0);
});

test('should avoid duplicating known DOM ancestors or including ECMAScript intrinsic declarations', () => {
  assert.equal(inventory.surface.inheritedDeclarations.some((entry) => entry.receiver === 'Window.HTMLDivElement'), false);
  assert.equal(inventory.surface.inheritedDeclarations.some((entry) => entry.receiver === 'Window.DOMException' && entry.constructorName === 'Error'), false);
  assert.equal(inventory.surface.apis.some((entry) => entry.inheritance?.constructorName === 'Object'), false);
  const ids = inventory.surface.apis.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('should record stylesheet base declarations and exercise insertion and removal through the real interface', () => {
  const dom = new JSDOM('');
  try {
    const inherited = inventory.surface.apis.find((entry) => entry.inheritance?.receiver === 'Window.CSSStyleSheet' && entry.name === 'insertRule');
    assert.ok(inherited);
    const base = Object.getPrototypeOf(dom.window.CSSStyleSheet.prototype);
    assert.equal(inherited.arity, Object.getOwnPropertyDescriptor(base, 'insertRule').value.length);
    const sheet = new dom.window.CSSStyleSheet();
    const index = sheet.insertRule('a { color: red; }', 0);
    assert.equal(index, 0); assert.equal(sheet.cssRules[0].style.color, 'red');
    sheet.deleteRule(0); assert.equal(sheet.cssRules.length, 0);
  } finally { dom.window.close(); }
});

test('should record the WindowProperties tag while preserving the distinct dynamic named-property contract', () => {
  const dom = new JSDOM('<form id="inventoryNamed"></form>');
  try {
    const inherited = inventory.surface.apis.find((entry) => entry.inheritance?.receiver === 'Window.Window' && entry.name === '@@toStringTag');
    assert.ok(inherited);
    const base = Object.getPrototypeOf(dom.window.Window.prototype);
    const descriptor = Object.getOwnPropertyDescriptor(base, Symbol.toStringTag);
    assert.equal(inherited.valueType, typeof descriptor.value);
    assert.equal(inherited.configurable, descriptor.configurable);
    assert.equal(inherited.enumerable, descriptor.enumerable);
    assert.equal(dom.window.inventoryNamed, dom.window.document.querySelector('form'));
    assert.equal(inventory.surface.apis.some((entry) => entry.name === 'inventoryNamed'), false);
  } finally { dom.window.close(); }
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
  assert.equal(audited.summary.counts.files.states.hybrid, 5);
  assert.equal(audited.summary.counts.files.audited, 7);
  assert.equal(audited.summary.counts.callableUnits.states['rust-complete'], 1);
  assert.equal(audited.summary.counts.apis.states.hybrid, 1);
  const serializerAlgorithm = audited.classification.find((entry) => entry.id === 'unit:lib/jsdom/living/domparsing/XMLSerializer-impl.js:11:3');
  const serializerApi = audited.classification.find((entry) => entry.id === 'api:Window.XMLSerializer.prototype.serializeToString');
  assert.equal(serializerAlgorithm.status, 'rust-complete');
  assert.deepEqual(serializerAlgorithm.pending, []);
  assert.equal(serializerApi.status, 'hybrid');
  assert.ok(serializerApi.pending.length > 0, 'Native method control does not complete its generated WebIDL API');
  const nodeHelpers = audited.classification.find((entry) => entry.id === 'module:lib/jsdom/living/node.js');
  assert.equal(nodeHelpers.auditComplete, true);
  assert.equal(nodeHelpers.status, 'hybrid');
  assert.ok(nodeHelpers.rustSources.length > 0);
  assert.ok(nodeHelpers.javascriptSources.length > 0);
  assert.ok(nodeHelpers.pending.length > 0, 'Native filters do not complete the remaining clone and conversion controllers');
  const stringHelpers = audited.classification.find((entry) => entry.id === 'module:lib/jsdom/living/helpers/strings.js');
  assert.equal(stringHelpers.auditComplete, true);
  assert.equal(stringHelpers.status, 'pending');
  assert.deepEqual(stringHelpers.rustSources, []);
  const stringUnits = audited.classification.filter((entry) => entry.id.startsWith('unit:lib/jsdom/living/helpers/strings.js:'));
  assert.equal(stringUnits.length, 13);
  for (const unit of stringUnits) {
    assert.equal(unit.auditComplete, true); assert.equal(unit.status, 'pending');
    assert.deepEqual(unit.rustSources, []); assert.ok(unit.pending.length > 0);
  }
  const nameValidation = audited.classification.find((entry) => entry.id === 'module:lib/jsdom/living/helpers/validate-names.js');
  assert.equal(nameValidation.auditComplete, true); assert.equal(nameValidation.status, 'pending');
  assert.deepEqual(nameValidation.rustSources, []);
  const nameUnits = audited.classification.filter((entry) => entry.id.startsWith('unit:lib/jsdom/living/helpers/validate-names.js:'));
  assert.equal(nameUnits.length, 3);
  for (const unit of nameUnits) {
    assert.equal(unit.auditComplete, true); assert.equal(unit.status, 'pending');
    assert.deepEqual(unit.rustSources, []); assert.ok(unit.pending.length > 0);
  }
  const htmlParser = audited.classification.find((entry) => entry.id === 'module:lib/jsdom/browser/parser/html.js');
  assert.equal(htmlParser.auditComplete, true); assert.equal(htmlParser.status, 'hybrid');
  assert.ok(htmlParser.rustSources.includes('src/lib.rs'));
  assert.ok(htmlParser.javascriptSources.includes('src/parser/bridge.cjs'));
  assert.ok(htmlParser.pending.length > 0);
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
