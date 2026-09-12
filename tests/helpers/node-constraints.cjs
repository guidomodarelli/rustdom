/** @file Provides real DOM fixtures shared by insertion and replacement contract tests. */
'use strict';
/** Cover valid containers and the earlier invalid-parent gate. */
const PARENT_KINDS = ['element', 'fragment', 'text', 'comment', 'attribute', 'doctype',
  'document-empty', 'document-doctype', 'document-element', 'document-comments-doctype',
  'document-element-comments', 'document-complete'];
/** Include fragment structure and CDATA distinctions from the pinned runtime. */
const CANDIDATE_KINDS = ['element', 'fragment-empty', 'fragment-element', 'fragment-elements',
  'fragment-text', 'fragment-cdata', 'text', 'cdata', 'comment', 'instruction', 'doctype', 'document', 'attribute', 'shadow'];

/** @param {Document} document - Fixture document. @param {string} kind - Parent fixture. @returns {Node} Real insertion receiver. */
function parentFixture(document, kind) {
  if (kind.startsWith('document-')) {
    if (kind === 'document-complete') return document.implementation.createHTMLDocument('fixture');
    const parent = document.implementation.createDocument(null, null);
    if (kind === 'document-comments-doctype') parent.append(parent.createComment('first'), parent.createComment('second'));
    if (kind.includes('doctype')) parent.append(parent.implementation.createDocumentType('root', '', ''));
    if (kind.includes('element')) parent.append(parent.createElement('root'));
    if (kind === 'document-element-comments') parent.append(parent.createComment('first'), parent.createComment('second'));
    return parent;
  }
  if (kind === 'text') return document.createTextNode('parent');
  if (kind === 'comment') return document.createComment('parent');
  if (kind === 'attribute') return document.createAttribute('parent');
  if (kind === 'doctype') return document.implementation.createDocumentType('parent', '', '');
  const parent = kind === 'fragment' ? document.createDocumentFragment() : document.createElement('section');
  parent.append(document.createComment('owned')); return parent;
}

/** @param {Document} document - Source document, which can differ from the receiver. @param {string} kind - Candidate fixture. @returns {Node} Actual node to insert. */
function candidateFixture(document, kind) {
  if (kind.startsWith('fragment-')) {
    const fragment = document.createDocumentFragment();
    if (kind === 'fragment-element' || kind === 'fragment-elements') fragment.append(document.createElement('child'));
    if (kind === 'fragment-elements') fragment.append(document.createElement('second'));
    if (kind === 'fragment-text') fragment.append('text');
    if (kind === 'fragment-cdata') fragment.append(candidateFixture(document, 'cdata'));
    return fragment;
  }
  if (kind === 'text') return document.createTextNode('text');
  if (kind === 'cdata') return document.implementation.createDocument(null, 'xml').createCDATASection('data');
  if (kind === 'comment') return document.createComment('comment');
  if (kind === 'instruction') return document.createProcessingInstruction('target', 'instruction');
  if (kind === 'doctype') return document.implementation.createDocumentType('candidate', '', '');
  if (kind === 'document') return document.implementation.createDocument(null, 'candidate');
  if (kind === 'attribute') return document.createAttribute('candidate');
  if (kind === 'shadow') {
    const root = document.createElement('aside').attachShadow({ mode: 'closed' }); root.append(document.createElement('shadow-child')); return root;
  }
  return document.createElement('candidate');
}

/** @param {Node} node - Observed node. @returns {object} Public data, independent of object addresses. */
function shape(node) { return { kind: node.nodeType, name: node.nodeName, value: node.nodeValue }; }

module.exports = { PARENT_KINDS, CANDIDATE_KINDS, parentFixture, candidateFixture, shape };
