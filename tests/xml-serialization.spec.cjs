/** @file Public XML serialization parity, including UTF-16, namespace quirks and observable wrapper reads. */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const runtimes = { jsdom: require('jsdom'), rustdom: require('../dist/index.cjs') };
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const HTML = 'http://www.w3.org/1999/xhtml';
const report = { capturedAt: new Date().toISOString(), cases: [] };

/** @param {Function} operation - Actual public operation. @param {Window} window - Expected exception realm. @returns {object} Value or original error contract. */
function capture(operation, window) {
  try { return { value: operation() }; }
  catch (error) { return { error: error.name, message: error.message, code: error.code ?? null, domException: error instanceof window.DOMException }; }
}
/** @param {object} dom - Real JSDOM. @param {Node} root - Node returned by a scenario. @returns {object} Public serialization entrypoints on current data. */
function serialize(dom, root) {
  const { window } = dom;
  return {
    serializer: capture(() => new window.XMLSerializer().serializeToString(root), window),
    outer: capture(() => root.outerHTML ?? null, window),
    inner: capture(() => root.innerHTML ?? null, window),
    document: capture(() => dom.serialize(), window),
  };
}
/** @param {string} name - Contract description. @param {Function} scenario - DOM setup and observations. @param {boolean} [html] - Choose an HTML document. @returns {void} Registers a real differential scenario. */
function compare(name, scenario, html = false) {
  test(`should ${name}`, () => {
    const results = {};
    for (const [engine, runtime] of Object.entries(runtimes)) {
      const dom = new runtime.JSDOM(html ? '<main></main>' : '<r/>', html ? {} : { contentType: 'text/xml' });
      try { results[engine] = scenario(dom, dom.window.document); }
      finally { dom.window.close(); }
    }
    report.cases.push({ name, expected: results.jsdom, actual: results.rustdom });
    assert.deepEqual(results.rustdom, results.jsdom);
  });
}

for (const namespace of [null, 'urn:root', XML, XMLNS, HTML, 'constructor', '__proto__', 'toString']) {
  for (const qualified of [false, true]) {
    for (const declaration of ['none', 'same', 'conflict', 'empty']) {
      compare(`preserve namespaces ${JSON.stringify([namespace, qualified, declaration])}`, (dom, document) => {
        const prefix = namespace === XMLNS ? 'xmlns' : 'p';
        const root = document.createElementNS(namespace, qualified && namespace !== null ? `${prefix}:root` : namespace === XMLNS ? 'xmlns' : 'root');
        document.replaceChild(root, document.documentElement);
        if (declaration !== 'none') root.setAttributeNS(XMLNS, 'xmlns', declaration === 'empty' ? '' : declaration === 'same' ? namespace ?? '' : 'urn:conflict');
        root.setAttributeNS('urn:attr', 'a:value', 'quotes"<&>\t\n\r');
        root.setAttributeNS('urn:attr', 'b:other', 'second');
        root.setAttributeNS(XML, 'xml:lang', 'es');
        root.append(document.createElementNS(namespace === HTML ? HTML : 'urn:child', 'child'));
        return serialize(dom, root);
      });
    }
  }
}

for (const data of ['', 'normal', '<&>"\t\n\r', '\0', '\u0001', '\ud800', '\udfff', '🦀', '\ufffe', 'a--b-', 'a]]>b', 'a?>b']) {
  for (const kind of ['text', 'comment', 'cdata', 'attribute']) {
    compare(`preserve ${kind} escaping and well-formedness for ${JSON.stringify(data)}`, (dom, document) => {
      const root = document.documentElement;
      let child;
      if (kind === 'text') child = document.createTextNode(data);
      if (kind === 'comment') child = document.createComment(data);
      if (kind === 'cdata') {
        child = document.createCDATASection('initial'); child.data = data;
      }
      if (kind === 'attribute') { child = document.createAttribute('a'); child.value = data; root.setAttributeNode(child); }
      else root.append(child);
      return { root: serialize(dom, root), node: capture(() => new dom.window.XMLSerializer().serializeToString(child), dom.window) };
    });
  }
}

for (const name of ['br', 'menuitem', 'input', 'template', 'script', 'custom-node']) {
  for (const populated of [false, true]) {
    compare(`preserve HTML element ${name} in XML serialization with children ${populated}`, (dom, document) => {
      const root = document.createElement(name); document.body.append(root);
      const container = root.content ?? root;
      if (populated) container.append(document.createTextNode('<&>'), document.createElement('b'));
      return serialize(dom, root);
    }, true);
  }
}

for (const value of ['', 'public', 'double"quote', "single'quote", '\u0001', '\ud800']) {
  compare(`preserve doctype serialization for ${JSON.stringify(value)}`, (dom, document) => {
    const doctype = document.implementation.createDocumentType('root', value, `system${value}`);
    document.insertBefore(doctype, document.documentElement);
    return serialize(dom, doctype);
  });
  compare(`preserve processing-instruction serialization for ${JSON.stringify(value)}`, (dom, document) => {
    const instruction = document.createProcessingInstruction('target', 'initial'); instruction.data = value;
    document.documentElement.append(instruction);
    return serialize(dom, instruction);
  });
}

compare('preserve namespace prefix reuse across sibling and nested declarations', (dom, document) => {
  const root = document.documentElement;
  root.setAttributeNS(XMLNS, 'xmlns:p', 'urn:common');
  for (const prefix of ['p', 'q', 'p']) {
    const child = document.createElementNS('urn:common', `${prefix}:child`);
    child.setAttributeNS(XMLNS, `xmlns:${prefix}`, 'urn:common');
    child.setAttributeNS('urn:fresh', 'a:value', 'first');
    const grandchild = document.createElementNS('urn:other', 'p:nested');
    grandchild.setAttributeNS('urn:fresh', 'b:value', 'second'); child.append(grandchild); root.append(child);
  }
  return serialize(dom, root);
});

/** @param {object} node - Public object. @param {string} property - Getter to observe. @param {Function} read - Read behavior. @returns {void} Installs a real own getter. */
function observe(node, property, read) { Object.defineProperty(node, property, { configurable: true, get: read }); }

for (const property of ['nodeType', 'namespaceURI', 'prefix', 'localName', 'attributes', 'childNodes']) {
  compare(`preserve public getter order for element ${property}`, (dom, document) => {
    const root = document.documentElement; root.setAttributeNS('urn:attr', 'p:a', 'value'); root.append(document.createTextNode('text'));
    const trace = []; const original = root[property];
    observe(root, property, () => { trace.push(property); return original; });
    return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
  });
  compare(`preserve getter exceptions from element ${property}`, (dom, document) => {
    const root = document.documentElement; const trace = [];
    observe(root, property, () => { trace.push(property); throw new Error(`getter ${property}`); });
    return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
  });
}

for (const property of ['namespaceURI', 'prefix', 'localName', 'value']) {
  compare(`preserve repeated attribute getter reads for ${property}`, (dom, document) => {
    const root = document.documentElement; root.setAttributeNS(XMLNS, 'xmlns:p', 'urn:a'); root.setAttributeNS('urn:a', 'p:v', 'value');
    const trace = [];
    for (const attribute of root.attributes) {
      const original = attribute[property]; const name = attribute.name;
      observe(attribute, property, () => { trace.push([name, property]); return original; });
    }
    return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
  });
}

compare('observe live child-list mutation performed while reading serialized text', (dom, document) => {
  const root = document.documentElement; const text = document.createTextNode('original'); root.append(text);
  let changed = false; const trace = [];
  observe(text, 'data', () => { trace.push('data'); if (!changed) { changed = true; root.append(document.createElement('added')); } return '<&>'; });
  return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace, children: root.childNodes.length };
});

compare('invoke custom child and attribute iterators through the public collections', (dom, document) => {
  const root = document.documentElement; root.setAttribute('a', 'one'); root.append(document.createTextNode('text'));
  const children = [...root.childNodes]; const attributes = [...root.attributes]; const trace = [];
  observe(root, 'childNodes', () => ({ length: children.length, *[Symbol.iterator]() { trace.push('children'); yield* children; } }));
  observe(root, 'attributes', () => ({ length: attributes.length, 0: attributes[0], *[Symbol.iterator]() { trace.push('attributes'); yield* attributes; } }));
  return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
});

for (const property of ['namespaceURI', 'prefix', 'localName', 'value']) {
  for (const entry of ['outer', 'inner']) {
    compare(`preserve well-formed ${entry} attribute read order for ${property}`, (dom, document) => {
      const root = document.createElement('child'); document.documentElement.append(root);
      root.setAttributeNS('urn:a', 'p:first', 'one'); root.setAttributeNS('urn:a', 'p:second', 'two');
      const trace = [];
      for (const attribute of root.attributes) { const original = attribute[property]; const name = attribute.name; observe(attribute, property, () => { trace.push([name, property]); return original; }); }
      const output = capture(() => entry === 'outer' ? root.outerHTML : document.documentElement.innerHTML, dom.window);
      return { output, trace };
    });
  }
}

for (const thrownKind of ['error', 'messageGetter', 'null', 'undefined', 'string', 'symbol']) {
  for (const returnThrows of [false, true]) {
    compare(`close custom child iterators after ${thrownKind} with return throwing ${returnThrows}`, (dom, document) => {
      const root = document.documentElement; const child = document.createTextNode('text'); root.append(child); const trace = [];
      let thrown = new Error('primary');
      if (thrownKind === 'messageGetter') Object.defineProperty(thrown, 'message', { get() { trace.push('message'); return 'primary'; } });
      if (thrownKind === 'null') thrown = null;
      if (thrownKind === 'undefined') thrown = undefined;
      if (thrownKind === 'string') thrown = 'primary';
      if (thrownKind === 'symbol') thrown = Symbol('primary');
      observe(child, 'data', () => { trace.push('data'); throw thrown; });
      observe(root, 'childNodes', () => ({ length: 1, [Symbol.iterator]() { trace.push('iterator'); return {
        next() { trace.push('next'); return { done: false, value: child }; },
        return() { trace.push('return'); if (returnThrows) throw new Error('secondary'); return {}; },
      }; } }));
      return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
    });
  }
}

compare('preserve a dynamic replacement result at the root and default coercion inside a parent', (dom, document) => {
  const root = document.documentElement; const text = document.createTextNode('original'); root.append(text); const trace = [];
  const result = { replace(pattern, replacement) { trace.push([String(pattern), replacement]); return this; },
    [Symbol.toPrimitive](hint) { trace.push(['primitive', hint]); return 'dynamic'; } };
  observe(text, 'data', () => result);
  const serializer = new dom.window.XMLSerializer();
  const rootResult = serializer.serializeToString(text);
  const rootTrace = trace.splice(0);
  const parentResult = serializer.serializeToString(root);
  return { rawIdentity: rootResult === result, rawType: typeof rootResult, rootTrace, parentResult, parentTrace: trace };
});

compare('allow reentrant native serialization while reading a public getter', (dom, document) => {
  const root = document.documentElement; const text = document.createTextNode('text'); const inner = document.createElement('nested'); root.append(text);
  const trace = []; const serializer = new dom.window.XMLSerializer();
  observe(text, 'data', () => { trace.push(serializer.serializeToString(inner)); return 'outer'; });
  return { output: serializer.serializeToString(root), trace };
});

for (const target of ['element-namespace', 'declaration-value']) {
  compare(`preserve symbol-valued property keys from ${target}`, (dom, document) => {
    const root = document.createElementNS('urn:r', 'p:root'); document.replaceChild(root, document.documentElement);
    const trace = []; const key = Symbol('namespace-key');
    const value = {
      [Symbol.toPrimitive](hint) { trace.push(['key', hint]); return key; },
      replace(pattern, replacement) { trace.push(['replace', String(pattern), replacement]); return 'urn:synthetic'; },
    };
    if (target === 'element-namespace') observe(root, 'namespaceURI', () => value);
    else { root.setAttributeNS(XMLNS, 'xmlns:p', 'urn:r'); observe(root.getAttributeNodeNS(XMLNS, 'p'), 'value', () => value); }
    return { output: capture(() => new dom.window.XMLSerializer().serializeToString(root), dom.window), trace };
  });
}

after(() => {
  mkdirSync('reports/compatibility', { recursive: true });
  writeFileSync(`reports/compatibility/${report.capturedAt.replaceAll(':', '-')}-xml-serialization.json`, `${JSON.stringify(report, null, 2)}\n`);
});
