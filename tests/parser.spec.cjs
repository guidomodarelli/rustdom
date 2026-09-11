/** @file Compares observable browser behavior with an unmodified jsdom dependency. */
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

/** Load both real runtimes through Node, including their native and ESM dependencies. */
const nodeRequire = require('node:module').createRequire(__filename);
/** Keep the reference runtime outside rustdom's private module graph. */
const reference = nodeRequire('jsdom');
/** Exercise the compiled native-backed product. */
const rustdom = nodeRequire('../dist/index.cjs');

/** Cover malformed HTML, insertion modes, namespaces, templates, and Unicode. */
const documents = [
  '', '<!doctype html><p>Hello &amp; goodbye &#x1F980;</p>',
  '<table><tr><td>A<td>B</table>end',
  '<p><b>one<i>two</b>three</i>',
  '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN"><p>quirks',
  '<!--before--><html lang=en><head><title>A&lt;B</title><body><input disabled>',
  '<template><table><tr><td>inert</table><template><b>nested</b></template></template>',
  '<svg viewBox="0 0 1 1"><linearGradient id="x"/><foreignObject><p>HTML</p></foreignObject></svg>',
  '<math><mi>x</mi><annotation-xml encoding="text/html"><p>html</p></annotation-xml></math>',
  '<svg><a xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#x">link</a></svg>',
  '<textarea>\n&lt;hello&gt;</textarea><style>b::before{content:"<"}</style>',
  '<noscript><p>visible</p></noscript><script>window.executed = true</script>',
  '<form id=f><input name=n><form><button>go</button></form>',
  '<div DATA-X="a" data-x="b">\r\nhello\0world</div>',
  '<p>Español 日本語 🦀 &notit; &#0;</p>',
];

/**
 * Read attributes and template ownership that serialization alone cannot prove.
 * @param {Document} document - Browser document under inspection.
 * @returns {object} Observable namespace, document mode, and inert-template details.
 */
function describeDocument(document) {
  return {
    mode: document.compatMode,
    elements: [...document.querySelectorAll('*')].map((element) => ({
      name: element.localName, namespace: element.namespaceURI,
      attributes: [...element.attributes].map((attribute) => [attribute.name,
        attribute.value, attribute.namespaceURI, attribute.prefix]),
      template: element.localName === 'template' ? {
        html: element.innerHTML, children: element.content.childNodes.length,
        inert: element.content.ownerDocument !== document,
      } : null,
    })),
  };
}

describe('HTML5 document compatibility', () => {
  for (const html of documents) test(`should match jsdom when parsing ${html}`, () => {
    const before = rustdom.getParserStatistics();
    const expected = new reference.JSDOM(html);
    const actual = new rustdom.JSDOM(html);
    try {
      assert.equal(actual.serialize(), expected.serialize());
      assert.deepEqual(describeDocument(actual.window.document), describeDocument(expected.window.document));
      assert.equal(rustdom.getParserStatistics().nativeDocument, before.nativeDocument + 1);
      assert.equal(actual.window.executed, undefined);
    } finally {
      expected.window.close();
      actual.window.close();
    }
  });
});

describe('contextual fragment compatibility', () => {
  for (const [tag, html] of [
    ['div', '<p>a<b>b</p>c'], ['table', '<tr><td>A<td>B'],
    ['tbody', '<tr><td>x'], ['tr', '<td>A<td>B'],
    ['textarea', '&amp;<b>literal'],
    ['template', '<tr><td>x'], ['div', '<template><b>inside</b></template>'],
    ['svg', '<circle cx="1"/><foreignObject><div>x</div></foreignObject>'],
    ['div', '<style>p { color: red; }</style><p>style</p>'],
  ]) test(`should match jsdom when setting ${tag}.innerHTML to ${html}`, () => {
    const expected = new reference.JSDOM('<!doctype html><body>');
    const actual = new rustdom.JSDOM('<!doctype html><body>');
    const before = rustdom.getParserStatistics();
    try {
      for (const dom of [expected, actual]) {
        const element = tag === 'svg' ? dom.window.document.createElementNS('http://www.w3.org/2000/svg', tag)
          : dom.window.document.createElement(tag);
        dom.window.document.body.append(element);
        element.innerHTML = html;
      }
      assert.equal(actual.serialize(), expected.serialize());
      assert.deepEqual(describeDocument(actual.window.document), describeDocument(expected.window.document));
      assert.equal(rustdom.getParserStatistics().nativeFragment, before.nativeFragment + 1);
    } finally {
      expected.window.close(); actual.window.close();
    }
  });
});

describe('explicit compatibility routes', () => {
  for (const namespace of [null, 'urn:\ud800']) test(`should preserve fragment parsing in namespace ${JSON.stringify(namespace)}`, () => {
    const expected = new reference.JSDOM('');
    const actual = new rustdom.JSDOM('');
    try {
      const fragments = [expected, actual].map((dom) => {
        const element = dom.window.document.createElementNS(namespace, 'root');
        element.innerHTML = '<child>text &amp; value</child>';
        return element.innerHTML;
      });
      assert.equal(fragments[1], fragments[0]);
    } finally { expected.window.close(); actual.window.close(); }
  });
  for (const html of ['<table>foster<tr><td>A<td>B</table>end', '<p>\ud800</p>', '<div title="\udc00">x</div>',
    '<select><optgroup label=a><option>one<option>two</select>', '<select><button>X</button><option>Y</select>',
    '<body foo="first"><body foo="second">', '<html xml:lang="a"><html xml:lang="b">']) {
    test(`should retain jsdom edge semantics when parsing ${JSON.stringify(html)}`, () => {
      const expected = new reference.JSDOM(html);
      const actual = new rustdom.JSDOM(html);
      try { assert.equal(actual.serialize(), expected.serialize()); }
      finally { expected.window.close(); actual.window.close(); }
    });
  }
  test('should preserve legacy select parsing and quirks fragment context', () => {
    for (const [tag, markup] of [['select', '<input><option>X'], ['div', '<p>text<table><tr><td>x']]) {
      const expected = new reference.JSDOM('');
      const actual = new rustdom.JSDOM('');
      try {
        for (const dom of [expected, actual]) {
          const element = dom.window.document.createElement(tag);
          dom.window.document.body.append(element);
          element.innerHTML = markup;
        }
        assert.equal(actual.serialize(), expected.serialize());
      } finally { expected.window.close(); actual.window.close(); }
    }
  });
  test('should execute parser-inserted scripts and document.write when requested', () => {
    const before = rustdom.getParserStatistics();
    const dom = new rustdom.JSDOM('<p id=a>A</p><script>document.write("<b id=b>B</b>");window.result=document.querySelector("#a").textContent</script>',
      { runScripts: 'dangerously' });
    try {
      assert.equal(dom.window.result, 'A');
      assert.equal(dom.window.document.querySelector('#b').textContent, 'B');
      assert.ok(rustdom.getParserStatistics().fallback['document-scripts'] > (before.fallback['document-scripts'] || 0));
    } finally { dom.window.close(); }
  });

  test('should preserve source positions when includeNodeLocations is enabled', () => {
    const dom = new rustdom.JSDOM('<!doctype html>\n<p>Hello</p>', { includeNodeLocations: true });
    try {
      assert.equal(dom.nodeLocation(dom.window.document.querySelector('p')).startLine, 2);
      assert.equal(dom.nodeLocation(dom.window.document.querySelector('p')).startOffset, 16);
    } finally { dom.window.close(); }
  });

  test('should preserve form ownership when a fragment has a form ancestor', () => {
    const dom = new rustdom.JSDOM('<!doctype html><form id=f><div></div></form>');
    try {
      dom.window.document.querySelector('div').innerHTML = '<form id=nested><input name=x></form>';
      assert.equal(dom.window.document.querySelector('#nested'), null);
      assert.equal(dom.window.document.querySelector('input').form.id, 'f');
    } finally { dom.window.close(); }
  });

  test('should retain XML parsing when the content type is XHTML', () => {
    const html = '<html xmlns="http://www.w3.org/1999/xhtml"><body><p/></body></html>';
    const expected = new reference.JSDOM(html, { contentType: 'application/xhtml+xml' });
    const actual = new rustdom.JSDOM(html, { contentType: 'application/xhtml+xml' });
    try { assert.equal(actual.serialize(), expected.serialize()); }
    finally { expected.window.close(); actual.window.close(); }
  });

  test('should keep ordinary jsdom untouched when rustdom is loaded alongside it', () => {
    const before = rustdom.getParserStatistics();
    const dom = new reference.JSDOM('<p>reference</p>');
    dom.window.document.body.innerHTML = '<b>still reference</b>';
    dom.window.close();
    assert.deepEqual(rustdom.getParserStatistics(), before);
  });
});
