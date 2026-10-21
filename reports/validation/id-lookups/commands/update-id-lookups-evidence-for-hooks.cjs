'use strict';
const fs = require('node:fs');
const primary = 'C:/Users/guido/ghq/projects/rustdom';
const root = 'C:/Users/guido/.codex/worktrees/native-collection-queries/rustdom';
for (const name of ['create-id-lookups-evidence-collector.cjs', 'compare-id-lookups-native-memory.cjs', 'render-id-lookups-docs.mjs']) {
  const path = primary + '/.cache/' + name;
  let source = fs.readFileSync(path, 'utf8').replaceAll('301', '299').replaceAll('3599', '3615');
  source = source.replace('baselineDifferentialTestsPerVersion: 90, focusedNodeTestsPerVersion: 93, focusedIntegrationTestsPerVersion: 854',
    'baselineDifferentialTestsPerVersion: 106, focusedNodeTestsPerVersion: 109, focusedIntegrationTestsPerVersion: integratedCount');
  source = source.replace("for (const node of ['v24.14.1', 'v22.12.0']) {", "let integratedCount;\nfor (const node of ['v24.14.1', 'v22.12.0']) {");
  source = source.replace("assert.match(await readFile(join(logsRoot, 'focal-' + node + '.log'), 'utf8'), /(?:ℹ|#) pass 854/);", "const log = await readFile(join(logsRoot, 'observable-hooks-' + node + '.log'), 'utf8');\n  const count = Number(log.match(/(?:ℹ|#) pass (\\\\d+)/)?.[1]);\n  assert.ok(count >= 954);\n  if (integratedCount !== undefined) assert.equal(count, integratedCount);\n  integratedCount = count;\n  assert.match(await readFile(join(logsRoot, 'baseline-observable-' + node + '.log'), 'utf8'), /(?:ℹ|#) pass 106/);");
  source = source.replace("'add-id-lookups-gc-test.cjs', 'native-id-lifecycle.cjs',", "'add-id-lookups-gc-test.cjs', 'native-id-lifecycle.cjs', 'fix-id-lookups-observable-hooks.cjs',\n  'validate-id-lookups-observable-hooks.sh', 'update-id-lookups-evidence-for-hooks.cjs',");
  source = source.replace("'Los hooks de alta y',\n  'baja leen el id canónico directamente en Rust; el cambio de valor realiza',", "'Los hooks de alta y',\n  'baja conservan la lectura observable getAttributeNS y pasan su valor a Rust;',\n  'el cambio de valor realiza',");
  source = source.replace("'de registrar o bajas leen", "'de registrar o bajas leen");
  source = source.replace("'Los índices reversos eliminan aliases cuando se libera Element o Document.',", "'Los índices reversos eliminan aliases cuando se libera Element o Document.',\n  'La primera suite general detectó 86 diferencias de trazas de FormData al',\n  'eliminar lecturas internas de ID. Se restauró la invocación original y se',\n  'agregaron dieciséis regresiones diferenciales de orden, aliases, excepciones',\n  'y mutación durante getAttributeNS. Se conserva la ejecución fallida original.',");
  fs.writeFileSync(path, source);
}
console.log('Updated evidence requirements for observable lifecycle hooks');
