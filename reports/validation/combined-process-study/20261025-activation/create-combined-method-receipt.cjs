'use strict';
const fs = require('node:fs');
const path = require('node:path');
const repository = path.resolve(__dirname, '..');
const method = path.join(repository, 'reports/benchmarks/native-class-ownership/combined-process-study');
const study = require(path.join(method, 'study.cjs'));
const { methodFilesDigest } = require(path.join(method, 'publication.cjs'));
const policy = require(path.join(method, 'constants/protocol.json'));
const capture = require(path.join(method, 'constants/capture.json'));
const files = study.sourceFiles();
const receipt = { revision: policy.revision, completeMethodReview: true, actionableFindings: 0,
  reviewType: 'isolated-local-static-complete-method', reviewer: '/root/review_ownership_closeout',
  reviewedBaseCommit: '3735c616cee124a7e7550512a03f9b964de7afc4',
  reviewedSourceState: 'Explicit authored source changes; not represented as a clean producer checkout',
  reviewedReport: '0 hallazgos accionables. El flujo vincula CI al workflow/SHA/intento/jobs exactos; conserva binding previo al artifact y exige extracción autenticada, payload completo, progreso, resultado terminal, exit y conclusiones API coherentes. 201=14+175+4+3+5. Revisión estática; siete contratos nuevos requieren ejecución y CI del SHA publicado antes de activar. Sin aceptación de rendimiento.',
  executionReady: policy.executionReady, packageArchiveSha256: policy.packageArchiveSha256,
  historicalHarnessSha256: policy.sourceHarnessSha256, acceptanceRule: policy.acceptanceRule,
  mandatoryContractWorkflow: capture.contractWorkflow, mandatoryChecks: capture.requiredChecks,
  methodFilesSha256: methodFilesDigest(files), files, historicalPinsPreserved: capture.historicalPins,
  performanceAccepted: null, gateReevaluated: false, newStudyActivated: false };
const destination = path.join(repository, capture.publicationReceipt);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: Object.keys(files).length, methodFilesSha256: receipt.methodFilesSha256,
  executionReady: receipt.executionReady, performanceAccepted: null, activated: false }));
