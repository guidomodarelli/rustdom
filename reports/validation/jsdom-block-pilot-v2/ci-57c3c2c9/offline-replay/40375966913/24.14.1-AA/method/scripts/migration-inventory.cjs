/** @module scripts/migration-inventory Builds reproducible reference catalogs with explicit migration audit gaps. */
'use strict';
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync, realpathSync, statSync } = require('node:fs');
const { join, dirname, resolve, relative, isAbsolute, sep } = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { captureReference } = require('./migration-inventory/reference.cjs');
const { capturePublicSurface } = require('./migration-inventory/surface.cjs');
const { INVENTORY_SCHEMA_VERSION, DEFAULT_INVENTORY_DIRECTORY, IMPLEMENTATION_STATES,
  INVENTORY_OUTPUT_FILES, DEFAULT_INVENTORY_AUDITS_FILE, JSDOM_EXPORT_MODULES,
  REFERENCE_GENERATED_DIRECTORY, REFERENCE_WINDOW_FILE, INVENTORY_ID_PREFIX, IMPLEMENTATION_STATE } = require('./constants/migration-inventory.cjs');

/**
 * Builds a catalog without interpreting a test count or a Rust symbol as completed migration.
 * The initial scope remains open until dependencies, dynamic contracts and semantic algorithms are audited.
 * @param {object} options - Independent reference, project source root and optional audited classifications.
 * @param {string} options.referenceRoot - Pinned jsdom package directory.
 * @param {string} options.repositoryRoot - Source tree whose implementation is classified.
 * @param {object} [options.audits] - Authored records keyed by stable reference IDs.
 * @returns {object} Deterministic catalogs and conservative, separately counted migration states.
 * @throws {Error} When reference version, audit identity, evidence path or state is invalid.
 */
function buildInventory({ referenceRoot, repositoryRoot, audits = {} }) {
  referenceRoot = realpathSync(referenceRoot);
  const project = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  const reference = captureReference(referenceRoot);
  assert.equal(reference.package.version, project.dependencies.jsdom, 'Inventory requires the project-pinned jsdom version');
  const surface = capturePublicSurface(referenceRoot);
  const units = reference.units;
  delete reference.units;
  const entries = [...reference.files, ...surface.apis, ...units];
  const ids = new Set(entries.map((entry) => entry.id));
  assert.equal(ids.size, entries.length, 'Inventory IDs must identify one reference unit');
  for (const id of Object.keys(audits)) assert.ok(ids.has(id), `Unknown inventory audit ID: ${id}`);
  function referenceModules(entry) {
    if (entry.moduleId) return [entry.moduleId];
    if (entry.path) return [entry.id];
    const parts = entry.owner.split('.');
    if (parts[0] === 'jsdom') return [`${INVENTORY_ID_PREFIX.module}${JSDOM_EXPORT_MODULES[parts[1] ?? entry.name] ?? JSDOM_EXPORT_MODULES.JSDOM}`];
    const interfaceName = parts[0] === 'Window' ? parts[1] ?? entry.name : parts[0];
    const generated = `${INVENTORY_ID_PREFIX.module}${REFERENCE_GENERATED_DIRECTORY}${interfaceName}.js`;
    return ids.has(generated) ? [generated] : [`${INVENTORY_ID_PREFIX.module}${REFERENCE_WINDOW_FILE}`];
  }
  const classification = entries.map((entry) => {
    const referenceModuleIds = referenceModules(entry);
    const audit = audits[entry.id];
    if (audit) {
      assert.ok(IMPLEMENTATION_STATES.includes(audit.status), `Invalid implementation status for ${entry.id}`);
      for (const field of ['rustSources', 'javascriptSources', 'tests', 'evidence', 'pending']) assert.ok(Array.isArray(audit[field]), `Inventory audit ${entry.id} requires ${field}`);
      for (const field of ['rustSources', 'javascriptSources', 'tests', 'evidence']) for (const file of audit[field]) {
        assert.ok(typeof file === 'string' && !isAbsolute(file), `Inventory evidence must be repository-relative for ${entry.id}`);
        const target = resolve(repositoryRoot, file), local = relative(repositoryRoot, target);
        assert.ok(local && local !== '..' && !local.startsWith('..' + sep), `Inventory evidence escapes repository: ${file}`);
        assert.ok(statSync(target, { throwIfNoEntry: false })?.isFile(), `Missing inventory evidence for ${entry.id}: ${file}`);
      }
      assert.ok(audit.status !== IMPLEMENTATION_STATE.rustComplete || (audit.rustSources.length && audit.tests.length && audit.evidence.length && !audit.pending.length), `Complete Rust audit lacks evidence or retains pending work: ${entry.id}`);
      return { ...audit, id: entry.id, referenceModuleIds, auditComplete: true };
    }
    return { id: entry.id, status: IMPLEMENTATION_STATE.pending, auditComplete: false, referenceModuleIds,
      rustSources: [], javascriptSources: [], tests: [], evidence: [],
      pending: ['Auditar las rutas actuales, registrar pruebas y completar la migración que corresponda.'] };
  });
  function count(selected) {
    const group = classification.filter((entry) => selected.has(entry.id));
    return { total: group.length, audited: group.filter((entry) => entry.auditComplete).length,
      states: Object.fromEntries(IMPLEMENTATION_STATES.map((status) => [status, group.filter((entry) => entry.status === status).length])) };
  }
  const summary = { schemaVersion: INVENTORY_SCHEMA_VERSION, reference: reference.package,
    counts: { files: count(new Set(reference.files.map((entry) => entry.id))),
      apis: count(new Set(surface.apis.map((entry) => entry.id))),
      callableUnits: count(new Set(units.map((entry) => entry.id))) },
    scopeClosed: false, migrationPercent: null,
    limitations: [
      'Los callables son anclas de implementación, no algoritmos normativos ya agrupados y auditados.',
      'Las dependencias externas requieren inventario de sus algoritmos de plataforma y de APIs heredadas.',
      'Faltan familias de propiedades dinámicas, diccionarios/opciones y perfiles adicionales de realms.',
      'Pending sin auditoría no significa ausencia de trabajo Rust: impide acreditar una migración sin evidencia.',
      'Los recuentos de archivos, APIs y callables son dimensiones separadas; no se suman ni estiman esfuerzo.',
    ] };
  return { reference, surface, units, classification, summary };
}

/** @param {object} inventory - Verified deterministic catalog. @param {string} directory - Destination directory. @returns {object} File digests for provenance. */
function writeInventory(inventory, directory) {
  mkdirSync(directory, { recursive: true });
  const manifest = {};
  for (const [name, filename] of Object.entries(INVENTORY_OUTPUT_FILES)) {
    const bytes = JSON.stringify(inventory[name], null, 2) + '\n';
    writeFileSync(join(directory, filename), bytes);
    manifest[filename] = createHash('sha256').update(bytes).digest('hex');
  }
  return manifest;
}

module.exports = { buildInventory, writeInventory };
if (require.main === module) {
  const { values } = parseArgs({ options: { reference: { type: 'string' }, output: { type: 'string' }, audits: { type: 'string' } } });
  const repositoryRoot = resolve(__dirname, '..');
  const audits = JSON.parse(readFileSync(resolve(values.audits ?? join(repositoryRoot, DEFAULT_INVENTORY_AUDITS_FILE)), 'utf8'));
  const inventory = buildInventory({ repositoryRoot, referenceRoot: values.reference ?? dirname(require.resolve('jsdom/package.json')), audits });
  const manifest = writeInventory(inventory, resolve(values.output ?? DEFAULT_INVENTORY_DIRECTORY));
  console.log(JSON.stringify({ ...inventory.summary, outputDigests: manifest }, null, 2));
}
