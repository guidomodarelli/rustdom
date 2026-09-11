/** @file Executes pinned HTML5 tree-construction inputs against jsdom and rustdom without running fixture scripts. */
'use strict';
const { readdirSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM: ReferenceDOM } = require('jsdom');
const { JSDOM: RustDOM, getParserStatistics } = require('../../dist/index.cjs');

/** Use the immutable corpus snapshot committed with the project. */
const corpusDirectory = 'tests/fixtures/html5lib/tree-construction';
/** Map corpus namespace designators to actual DOM namespace URIs. */
const namespaces = { html: 'http://www.w3.org/1999/xhtml', svg: 'http://www.w3.org/2000/svg', math: 'http://www.w3.org/1998/Math/MathML' };

/**
 * Evaluate document or contextual fragment HTML using a real browser-facing runtime.
 * @param {typeof ReferenceDOM} Implementation - Runtime constructor being tested.
 * @param {string} markup - Unmodified fixture HTML.
 * @param {string|undefined} context - Optional namespace/local-name context.
 * @returns {string} Observable HTML serialization.
 */
function evaluate(Implementation, markup, context) {
  const dom = new Implementation(context ? '<!doctype html>' : markup);
  try {
    if (!context) return dom.serialize();
    const parts = context.split(' ');
    const element = dom.window.document.createElementNS(namespaces[parts.length === 2 ? parts[0] : 'html'], parts.at(-1));
    element.innerHTML = markup;
    return element.innerHTML;
  } finally { dom.window.close(); }
}

/**
 * Compare every scripting-disabled corpus input and save all mismatches for diagnosis.
 * @returns {Promise<void>} Writes a durable result and fails on any mismatch.
 */
async function main() {
  const report = { capturedAt: new Date().toISOString(), revision: '9329e64694e7835d0dcff9811e22856ef6ad16f9',
    oracle: `jsdom ${require('jsdom/package.json').version}`, node: process.version,
    method: 'Differential HTML serialization; scripting disabled; normative trees and parse-error counts are not asserted.',
    total: 0, passed: 0, excludedScriptOn: 0, mismatches: [] };
  for (const file of readdirSync(corpusDirectory).filter((name) => name.endsWith('.dat')).sort()) {
    const contents = readFileSync(`${corpusDirectory}/${file}`, 'utf8');
    let caseNumber = 0;
    for (const block of contents.split(/^#data\n/m).slice(1)) {
      caseNumber++;
      report.total++;
      if (/^#script-on$/m.test(block)) { report.excludedScriptOn++; continue; }
      const markup = block.slice(0, block.indexOf('\n#errors'));
      const context = block.match(/^#document-fragment\n([^\n]+)/m)?.[1];
      let expected;
      let actual;
      try {
        expected = evaluate(ReferenceDOM, markup, context);
        actual = evaluate(RustDOM, markup, context);
        if (actual === expected) report.passed++;
        else report.mismatches.push({ file, caseNumber, context, markup, expected, actual });
      } catch (error) {
        report.mismatches.push({ file, caseNumber, context, markup, expected, actual, error: error.stack });
      }
      if (report.total % 50 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
        global.gc?.();
      }
    }
    process.stdout.write(`${file}: ${report.passed} compatibles, ${report.mismatches.length} diferencias\n`);
  }
  report.parserStatistics = getParserStatistics();
  mkdirSync('reports/validation', { recursive: true });
  writeFileSync('reports/validation/html5lib.json', `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.mismatches.length, 0, 'HTML5 corpus compatibility differs; see reports/validation/html5lib.json');
  process.stdout.write(`${report.passed}/${report.total - report.excludedScriptOn} casos comparados compatibles; ${report.excludedScriptOn} script-on excluidos.\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
