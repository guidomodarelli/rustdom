'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'C:/Users/guido/.codex/worktrees/native-collection-queries/rustdom';
const registryPath = root + '/src/dom/document_ids.rs';
let registry = fs.readFileSync(registryPath, 'utf8').replace('DOCUMENT_NODE, ELEMENT_NODE, ID_ATTRIBUTE_NAME', 'DOCUMENT_NODE, ELEMENT_NODE');
const start = registry.indexOf('    /// Read current canonical attributes before lifecycle registration');
const end = registry.indexOf('    fn document_id_operands', start);
assert.ok(start > 0 && end > start);
registry = registry.slice(0, start) + registry.slice(end);
const testsStart = registry.indexOf('    #[test]\n    fn should_read_current_null_namespace_ids_for_lifecycle_registration()');
assert.ok(testsStart > 0);
registry = registry.slice(0, testsStart) + '}\n';
fs.writeFileSync(registryPath, registry);
const bindingPath = root + '/src/dom/tree.rs';
let bindings = fs.readFileSync(bindingPath, 'utf8');
const bindingStart = bindings.indexOf('    #[napi]\n    pub fn attach_current_document_id(');
const bindingEnd = bindings.indexOf('    #[napi]\n    pub fn attach_document_id(', bindingStart);
assert.ok(bindingStart > 0 && bindingEnd > bindingStart);
bindings = bindings.slice(0, bindingStart) + bindings.slice(bindingEnd);
fs.writeFileSync(bindingPath, bindings);
const testPath = root + '/tests/id-lookups.spec.cjs';
let tests = fs.readFileSync(testPath, 'utf8');
const marker = '\nafter(() => {';
assert.equal(tests.split(marker).length, 2);
const additions = `
for (const mode of ['html', 'xml']) for (const realm of ['default', 'vm']) {
  for (const effect of ['trace', 'alias', 'throw-second', 'mutate-second']) {
    compare('preserve observable lifecycle ID reads with ' + effect, mode, realm, 'document', ({ document, root, scope }) => {
      const target = entry(document, 'observed', 'chosen');
      const implementation = target[Object.getOwnPropertySymbols(target).find((symbol) => symbol.description === 'impl')];
      const original = implementation.getAttributeNS;
      const marker = new Error('ID lifecycle getter failed');
      const trace = []; const outcomes = []; let reads = 0;
      implementation.getAttributeNS = function (namespace, name) {
        if (namespace === null && name === 'id') {
          reads++; trace.push([reads, this._attached, target.parentNode === root]);
          if (effect === 'throw-second' && reads === 2) throw marker;
          if (effect === 'mutate-second' && reads === 2) target.id = 'changed';
          if (effect === 'alias') return 'hook-alias';
        }
        return original.call(this, namespace, name);
      };
      const capture = (operation) => {
        let error = null;
        try { operation(); } catch (caughtError) { error = { name: caughtError.name, message: caughtError.message, sameError: caughtError === marker }; }
        outcomes.push({ error, parent: target.parentNode === root, connected: target.isConnected,
          ids: ['chosen', 'changed', 'hook-alias'].map((id) => scope.getElementById(id) === target) });
      };
      try { capture(() => root.append(target)); capture(() => target.remove()); }
      finally { implementation.getAttributeNS = original; }
      capture(() => root.append(target));
      return { trace, outcomes, id: target.id };
    });
  }
}
`;
tests = tests.replace(marker, additions + marker);
fs.writeFileSync(testPath, tests);
console.log('Restored observable lifecycle reads, removed unused direct-read entry points and added sixteen differential regressions');
