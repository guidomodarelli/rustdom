'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = '/home/guido/rustdom-attribute-copy-zCfwmZ';
const ts = require(root + '/node_modules/typescript');
const packageFile = require.resolve(root + '/node_modules/jsdom/package.json');
const reference = path.dirname(packageFile);
const modules = [], interfaces = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const relative = path.relative(reference, file).replaceAll(path.sep, '/');
    modules.push(relative);
    if (!relative.startsWith('lib/jsdom/living/generated/') || entry.name === 'utils.js') continue;
    const source = ts.createSourceFile(relative, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const members = [];
    function visit(node) {
      if (ts.isClassDeclaration(node) && node.name?.text === entry.name.slice(0, -3)) {
        for (const member of node.members) {
          if (member.name && (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member))) {
            members.push({ name: member.name.getText(source), kind: ts.isGetAccessor(member) ? 'get' : ts.isSetAccessor(member) ? 'set' : 'method' });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    interfaces.push({ path: relative, members });
  }
}
walk(reference + '/lib');
console.log(JSON.stringify({ version: JSON.parse(fs.readFileSync(packageFile)).version,
  modules: modules.length, generatedModules: interfaces.length,
  interfacesWithClass: interfaces.filter((entry) => entry.members.length > 0).length,
  classAccessorsAndMethods: interfaces.reduce((count, entry) => count + entry.members.length, 0),
  modulesWithoutClassMembers: interfaces.filter((entry) => entry.members.length === 0).map((entry) => entry.path),
  nodeExample: interfaces.find((entry) => entry.path.endsWith('/Node.js')) }, null, 2));
