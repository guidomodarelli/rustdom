/** @module rustdom/parser Provides a parse5-compatible boundary backed by html5ever. */
'use strict';

/** Keep the reference parser available for semantics requiring token-time callbacks. */
const reference = require('parse5');
/** Load the real native addon; a missing binary must fail rather than fake native execution. */
const native = require('../../dist/native.cjs');
/** Read private wrappers using the same generated WebIDL symbols as the private runtime. */
const { implForWrapper } = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
/** Count actual routes so compatibility tests and benchmarks can prove native execution. */
const statistics = { nativeDocument: 0, nativeFragment: 0, fallback: {} };
/** Detect repeated root start tags whose attribute merge semantics differ in jsdom 27. */
const ROOT_START_TAG = /<(html|body)(?=[\t\n\f\r />])/gi;

/**
 * Explain when native tree replay cannot preserve parser-time browser behavior.
 * @param {object} options - parse5 options including the upstream tree adapter.
 * @param {object|null} context - Fragment context, if present.
 * @returns {string|null} A fallback reason or null for a native-supported path.
 */
function fallbackReason(options, context) {
  if (options.sourceCodeLocationInfo) return 'source-locations';
  if (options.scriptingEnabled && !context) return 'document-scripts';
  if (context) {
    const namespace = options.treeAdapter.getNamespaceURI(context);
    if (namespace === null || !namespace.isWellFormed()) return 'fragment-namespace';
  }
  const document = options.treeAdapter?._documentImpl;
  const registry = document?._globalObject?._customElementRegistry;
  if (registry && implForWrapper(registry)._customElementDefinitions.length) {
    return 'custom-elements';
  }
  for (let ancestor = context; ancestor; ancestor = options.treeAdapter.getParentNode(ancestor)) {
    if (ancestor.localName === 'form') return 'form-context';
  }
  if (context?.localName === 'select') return 'legacy-select';
  return null;
}

/**
 * Keep UTF-16 strings lossless and preserve jsdom's repeated-root attribute merges.
 * @param {string} markup - HTML input prior to UTF-8 conversion.
 * @returns {string|null} A compatibility route when required by input semantics.
 */
function inputFallbackReason(markup) {
  if (!markup.isWellFormed()) return 'unpaired-surrogate';
  const roots = new Set();
  for (const match of markup.matchAll(ROOT_START_TAG)) {
    const name = match[1].toLowerCase();
    if (roots.has(name)) return 'root-attribute-merge';
    roots.add(name);
  }
  return null;
}

/**
 * Materialize a flat Rust tape through jsdom's existing node construction hooks.
 * @param {object} tape - Decoded native tape produced in one Node-API call.
 * @param {object} adapter - Upstream parse5 tree adapter.
 * @param {boolean} fragment - Whether to create a document fragment root.
 * @returns {object} The upstream document or document fragment implementation.
 */
function replay(tape, adapter, fragment) {
  const { events, mode } = tape;
  const root = fragment ? adapter.createDocumentFragment() : adapter.createDocument();
  if (!fragment) adapter.setDocumentMode(root, mode);
  const parents = [{ node: root, element: false }];
  for (const [kind, value, namespace, attributes] of events) {
    const parent = parents[parents.length - 1].node;
    switch (kind) {
      case 'element': {
        // parse5 represents absent namespaces/prefixes by missing keys.
        for (const attribute of attributes) {
          if (!attribute.namespace) delete attribute.namespace;
          if (!attribute.prefix) delete attribute.prefix;
        }
        const element = adapter.createElement(value, namespace, attributes);
        adapter.appendChild(parent, element);
        adapter.onItemPush?.(element);
        parents.push({ node: element, element: true });
        break;
      }
      case 'template': {
        const contents = adapter.createDocumentFragment();
        adapter.setTemplateContent(parent, contents);
        parents.push({ node: contents, element: false });
        break;
      }
      case 'close': {
        const removed = parents.pop();
        if (removed.element) {
          const current = parents.findLast((entry) => entry.element)?.node;
          adapter.onItemPop?.(removed.node, current);
        }
        break;
      }
      case 'text': adapter.insertText(parent, value); break;
      case 'comment': adapter.appendChild(parent, adapter.createCommentNode(value)); break;
      case 'doctype': adapter.setDocumentType(root, value, namespace, attributes); break;
      default: throw new Error(`rustdom: unknown native tape event ${kind}`);
    }
  }
  return root;
}

/**
 * Parse a document, retaining reference behavior for explicitly unsupported modes.
 * @param {string} markup - Decoded HTML input.
 * @param {object} options - Upstream parser configuration.
 * @returns {object} The populated document implementation.
 */
function parse(markup, options) {
  let reason = fallbackReason(options, null) || inputFallbackReason(markup);
  const tape = reason ? null : JSON.parse(native.parseDocumentTape(markup));
  reason ||= tape?.fallbackReason;
  if (reason) {
    statistics.fallback[reason] = (statistics.fallback[reason] || 0) + 1;
    return reference.parse(markup, options);
  }
  statistics.nativeDocument++;
  return replay(tape, options.treeAdapter, false);
}

/**
 * Parse contextual HTML fragments using native HTML5 insertion modes.
 * @param {object} context - Element whose innerHTML or adjacent content is parsed.
 * @param {string} markup - Decoded HTML fragment.
 * @param {object} options - Upstream parser configuration.
 * @returns {object} The parsed document fragment implementation.
 */
function parseFragment(context, markup, options) {
  let reason = fallbackReason(options, context) || inputFallbackReason(markup);
  if (reason) {
    statistics.fallback[reason] = (statistics.fallback[reason] || 0) + 1;
    return reference.parseFragment(context, markup, options);
  }
  const adapter = options.treeAdapter;
  const attributes = adapter.getAttrList(context).map((attribute) => ({
    name: attribute.name, value: attribute.value,
    namespace: attribute.namespace || undefined, prefix: attribute.prefix || undefined,
  }));
  if (attributes.some((attribute) => !attribute.value.isWellFormed() || !attribute.name.isWellFormed())) {
    statistics.fallback['unpaired-surrogate'] = (statistics.fallback['unpaired-surrogate'] || 0) + 1;
    return reference.parseFragment(context, markup, options);
  }
  const tape = JSON.parse(native.parseFragmentTape(markup, adapter.getTagName(context),
    adapter.getNamespaceURI(context), attributes, Boolean(options.scriptingEnabled)));
  if (tape.fallbackReason) {
    statistics.fallback[tape.fallbackReason] = (statistics.fallback[tape.fallbackReason] || 0) + 1;
    return reference.parseFragment(context, markup, options);
  }
  statistics.nativeFragment++;
  return replay(tape, adapter, true);
}

/**
 * Read independent counter snapshots without exposing mutable instrumentation state.
 * @returns {object} Native document/fragment counts and fallback counts by reason.
 */
function getParserStatistics() {
  return { ...statistics, fallback: { ...statistics.fallback } };
}

module.exports = { parse, parseFragment, getParserStatistics };
