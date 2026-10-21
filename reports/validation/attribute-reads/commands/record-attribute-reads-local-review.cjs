'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const snapshot = JSON.parse(fs.readFileSync('.cache/attribute-reads-review.json'));
for (const file of snapshot.entries) assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'), file.sha256, file.path);
const review = { capturedAt: new Date().toISOString(), provider: 'Codex native isolated read-only', base: snapshot.base,
  findings: [], files: snapshot.entries, executedTests: false, editedFiles: false, otherProviders: false,
  report: 'Cero hallazgos accionables en el snapshot de 20 archivos contra baa87fa; sus hashes coinciden. Se preservan aliases, folding ASCII, namespaces vacíos y el hook observable getAttributeNS. Las salidas se copian a V8 sin agregar owners persistentes. El harness compara operaciones públicas y contempla limpieza y GC. Revisión Codex estática; sin modificaciones, tests ni otros providers. No acredita rendimiento ni migración completa; el fallback público de title sigue en el host.',
  reflectionLimit: 'attribute-reflection mide HTMLElement.title, cuyo wrapper generado mantiene null → vacío en JavaScript. La proyección vacía nativa corresponde a attributeReflectionValue y los helpers de atributos, no a todo el getter title.' };
fs.writeFileSync('.cache/attribute-reads-local-review.json', JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ files: review.files.length, actionableFindings: 0, hashesMatch: true }));
