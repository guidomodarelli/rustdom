/** @module rustdom/xml-parser Adapts native XML events to the pinned jsdom parser callbacks. */
'use strict';
const { NativeXmlParser } = require('../../dist/native.cjs');
/** Shared predefined names cannot be overwritten by jsdom's DTD extension. */
const predefinedEntities = { __proto__: null, amp: '&', gt: '>', lt: '<', quot: '"', apos: "'" };

/** Implements only the parser boundary used by jsdom; XML decisions run in Rust. */
class SaxesParser {
  /** @param {object} options - Pinned jsdom document/fragment options. */
  constructor(options) { this.options = options; this.handlers = Object.create(null); this.ENTITIES = Object.create(predefinedEntities); this.native = null; }
  /** @param {string} name - Existing event name. @param {Function} handler - Real DOM builder callback. @returns {void} */
  on(name, handler) { this.handlers[name] = handler; }
  /** @param {string} markup - Complete jsdom input chunk. @returns {SaxesParser} Preserves the write/close chain. */
  write(markup) { this.native = new NativeXmlParser(markup, Boolean(this.options.fragment), this.options.fileName); return this; }
  /** @returns {SaxesParser} Delivers native events and returns control before each DOM effect. */
  close() {
    try {
      while (true) {
        const event = this.native.next();
        if (event.kind === 'end') return this;
        if (event.kind === 'resolvePrefix') { this.native.resolvePrefix(this.options.resolvePrefix?.(event.value)); continue; }
        if (event.kind === 'error') {
          if (event.errorType === 'RangeError') throw new RangeError(event.value);
          const error = new Error(event.value); if (this.handlers.error) this.handlers.error(error); else throw error;
          return this;
        }
        if (event.kind === 'opentag') {
          const attributes = Object.create(null);
          for (const attribute of event.tag.attributes) attributes[attribute.name] = attribute;
          this.handlers.opentag?.({ ...event.tag, attributes });
        } else if (event.kind === 'closetag') this.handlers.closetag?.({ name: event.value });
        else if (event.kind === 'processinginstruction') this.handlers.processinginstruction?.({ target: event.target, body: event.value });
        else {
          this.handlers[event.kind]?.(event.value);
          if (event.kind === 'doctype') for (const [name, value] of Object.entries(this.ENTITIES)) this.native.setEntity(name, value);
        }
      }
    } finally { this.native.close(); }
  }
}
module.exports = { SaxesParser };
