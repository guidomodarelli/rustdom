/** @module scripts/migration-inventory/reference Enumerates pinned upstream files, dependencies and callable anchors. */
'use strict';
const { readFileSync, readdirSync } = require('node:fs');
const { join, relative, resolve, sep } = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire, isBuiltin } = require('node:module');
const typescript = require('typescript');
const { REFERENCE_SOURCE_DIRECTORY, REFERENCE_GENERATED_DIRECTORY, INVENTORY_ID_PREFIX } = require('../constants/migration-inventory.cjs');

/** @param {string} directory - Existing reference directory. @returns {string[]} Deterministically ordered files. */
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  }).sort();
}

/**
 * Identifies a function without treating its name as evidence of native migration.
 * Anonymous callbacks remain explicit source anchors and require semantic grouping.
 * @param {object} node - TypeScript JavaScript AST node.
 * @param {object} source - Parsed source file.
 * @returns {string} Descriptive local label; the ID also includes its source position.
 */
function callableName(node, source) {
  if (typescript.isConstructorDeclaration(node)) return 'constructor';
  if (node.name) return node.name.getText(source);
  if (typescript.isVariableDeclaration(node.parent)) return node.parent.name.getText(source);
  if (typescript.isPropertyAssignment(node.parent)) return node.parent.name.getText(source);
  if (typescript.isBinaryExpression(node.parent)) return node.parent.left.getText(source);
  return '<anonymous>';
}

/**
 * Resolves an actual static dependency using the upstream module's own resolver.
 * @param {string} specifier - Literal require argument.
 * @param {string} file - Owning module.
 * @param {string} packageRoot - jsdom package root.
 * @returns {object} Internal, external or Node dependency, including unresolved outcomes.
 */
function dependency(specifier, file, packageRoot) {
  if (isBuiltin(specifier)) return { specifier, kind: 'node', target: specifier };
  try {
    const target = createRequire(file).resolve(specifier);
    const internal = relative(packageRoot, target);
    return internal.startsWith('..' + sep) || internal === '..' || resolve(target) === resolve(packageRoot)
      ? { specifier, kind: 'external', target: specifier }
      : { specifier, kind: 'internal', target: internal.split(sep).join('/') };
  } catch (error) {
    return { specifier, kind: 'unresolved', errorCode: error.code };
  }
}

/**
 * Captures all lib files and every callable body, including generated conversion code.
 * Function anchors are implementation units, not a claim of complete normative algorithms.
 * @param {string} packageRoot - Independently installed pinned jsdom package.
 * @returns {object} Reference provenance, file graph, callable units and dynamic dependency sites.
 * @throws {Error} When the package or a source file cannot be read or parsed.
 */
function captureReference(packageRoot) {
  const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const files = [], units = [], dynamicDependencies = [];
  const digest = createHash('sha256');
  for (const file of [...listFiles(join(packageRoot, REFERENCE_SOURCE_DIRECTORY)), join(packageRoot, 'package.json')].sort()) {
    const name = relative(packageRoot, file).split(sep).join('/');
    const bytes = readFileSync(file);
    const record = { id: `${INVENTORY_ID_PREFIX.module}${name}`, path: name, sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length, kind: name.endsWith('.js') ? 'javascript' : 'data',
      generated: name.startsWith(REFERENCE_GENERATED_DIRECTORY), dependencies: [] };
    files.push(record); digest.update(name).update('\0').update(bytes).update('\0');
    if (!name.endsWith('.js')) continue;
    const source = typescript.createSourceFile(name, bytes.toString('utf8'), typescript.ScriptTarget.Latest, true, typescript.ScriptKind.JS);
    if (source.parseDiagnostics.length) throw new Error(`Inventory cannot parse reference module ${name}: ${source.parseDiagnostics[0].messageText}`);
    function visit(node) {
      if (typescript.isFunctionLike(node) && node.body) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        const owner = node.parent;
        units.push({ id: `${INVENTORY_ID_PREFIX.unit}${name}:${position.line + 1}:${position.character + 1}`, moduleId: record.id,
          name: callableName(node, source), kind: typescript.SyntaxKind[node.kind], line: position.line + 1,
          column: position.character + 1, enclosingClass: owner.name && typescript.isClassLike(owner) ? owner.name.getText(source) : null,
          generated: record.generated });
      }
      if (typescript.isCallExpression(node) && typescript.isIdentifier(node.expression) && node.expression.text === 'require') {
        const argument = node.arguments[0];
        if (argument && typescript.isStringLiteral(argument)) record.dependencies.push(dependency(argument.text, file, packageRoot));
        else dynamicDependencies.push({ moduleId: record.id, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      }
      typescript.forEachChild(node, visit);
    }
    visit(source);
    record.dependencies = [...new Map(record.dependencies.map((entry) => [entry.specifier, entry])).values()];
  }
  return { package: { name: packageJson.name, version: packageJson.version,
    packageJsonSha256: createHash('sha256').update(readFileSync(join(packageRoot, 'package.json'))).digest('hex'),
    sourceHash: digest.digest('hex'), directDependencies: packageJson.dependencies }, files, units, dynamicDependencies };
}

module.exports = { captureReference };
