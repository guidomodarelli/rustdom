/** @file Preserves jsdom's actual doctype/entity heuristics through public XML documents. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const report = { capturedAt: new Date().toISOString(), cases: [] };

/** @param {object} runtime - Actual implementation. @param {string} declaration - Complete doctype. @param {string} content - Root content. @returns {object} Doctype identity, expanded content or exact failure with partial tree. */
function capture(runtime, declaration, content) {
  let window;
  try {
    const dom = new runtime.JSDOM(`${declaration}<r a="${content}">${content}</r>`, { contentType: 'application/xml', url: 'https://xml.test/doctype.xml', beforeParse(created) { window = created; } });
    const doctype = dom.window.document.doctype; const root = dom.window.document.documentElement;
    return { ok: true, doctype: doctype ? [doctype.name, doctype.publicId, doctype.systemId] : null,
      text: root.textContent, attribute: root.getAttribute('a'), serialized: dom.serialize() };
  } catch (error) {
    const doctype = window?.document.doctype;
    return { ok: false, error: [error.name, error.message, error.code ?? null], doctype: doctype ? [doctype.name, doctype.publicId, doctype.systemId] : null,
      rootName: window?.document.documentElement?.nodeName ?? null };
  } finally { window?.close(); }
}

const declarations = [
  '<!DOCTYPE html>', '<!DOCTYPE HTML>', '<!DOCTYPE r>', '<!DOCTYPE>', '<!DOCTYPE >',
  '<!DOCTYPE r PUBLIC "public" "system">', '<!DOCTYPE r public "public" "system" extra>',
  '<!DOCTYPE r PUBLIC "" "system">', '<!DOCTYPE r PUBLIC "public" "">',
  "<!DOCTYPE r PUBLIC 'public' 'system'>", '<!DOCTYPE r SYSTEM "system">', "<!DOCTYPE r SYSTEM 'system'>",
  '<!DOCTYPE r SYSTEM "">', '<!DOCTYPE r SYSTEM "sys" trailing>', '<!DOCTYPE r [<!ENTITY e "value">]>',
  '<!DOCTYPE r [<!ENTITY e "first"><!ENTITY e "second">]>', '<!DOCTYPE r [<!ENTITY amp "replacement"><!ENTITY e "&amp;">]>',
  "<!DOCTYPE r [<!ENTITY e 'single'>]>", '<!DOCTYPE r [<!ENTITY e "">]>', '<!DOCTYPE r [<!ENTITY  e "extra-space">]>',
  '<!DOCTYPE r [<!ENTITY e\t"tab">]>', '<!DOCTYPE r [<!ENTITY e "value" >]>', '<!DOCTYPE r [<!entity e "lowercase">]>',
  '<!DOCTYPE r [<!ENTITY nested "&e;"><!ENTITY e "later">]>',
  '<!DOCTYPE r [<!ENTITY bad! "accepted-by-extension">]>', '<!DOCTYPE r [<!ENTITY constructor "ctor"><!ENTITY __proto__ "proto">]>',
  '<!DOCTYPE r [<!ENTITY e "<!doctype html>">]>', '<!DOCTYPE r [<!ENTITY e "<!doctype X SYSTEM &quot;y&quot;>">]>',
];
for (const whitespace of [' ', '\t', '\n', '\r\n', '\u00a0', '\u0085', '\ufeff', '\u2003']) {
  declarations.push(`<!DOCTYPE${whitespace}r${whitespace}PUBLIC${whitespace}"public"${whitespace}"system">`);
}
for (const declaration of declarations) {
  for (const content of ['', '&e;', '&nested;', '&amp;', '&bad!;', '&constructor;&__proto__;']) {
    test(`should preserve XML doctype and entity behavior for ${JSON.stringify([declaration, content])}`, () => {
      const expected = capture(runtimes.jsdom, declaration, content); const actual = capture(runtimes.rustdom, declaration, content);
      report.cases.push({ declaration, content, expected, actual }); assert.deepEqual(actual, expected);
    });
  }
}
after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-doctype.json`, `${JSON.stringify(report, null, 2)}\n`);
});
