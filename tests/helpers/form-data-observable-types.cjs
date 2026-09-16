/** @file Real FormData construction with observable type/checkedness/name getters. */
'use strict';
/** @param {object} wrapper - Actual DOM wrapper. @returns {object} Its implementation for a reentrant behavior fixture. */
function implementation(wrapper) { return wrapper[Object.getOwnPropertySymbols(wrapper).find((symbol) => symbol.description === 'impl')]; }
/** @param {object} runtime - Actual jsdom/rustdom. @param {object} options - Input state, getter effect and realm. @returns {object} Observable output, ordering and exception identity. */
function observe(runtime, { mode, type, checked, effect }) {
  const dom = new runtime.JSDOM(`<form><input type="${type}" name="original" value="value"${checked ? ' checked' : ''}></form>`, mode === 'vm' ? { runScripts: 'outside-only' } : {});
  const form = dom.window.document.querySelector('form');
  const field = implementation(form.elements[0]);
  const trace = [];
  let typeReads = 0, checkedState = checked;
  const cause = { marker: 'getter cause' };
  const marker = new Error('observable getter failure', { cause });
  const getAttribute = field.getAttributeNS;
  field.getAttributeNS = function (namespace, name) { trace.push(`attribute:${name}`); return getAttribute.call(this, namespace, name); };
  Object.defineProperty(field, 'type', { configurable: true, get() {
    typeReads++; trace.push(`type:${typeReads}`);
    if ((effect === 'rename-second' && typeReads === 2) || (effect === 'rename-third' && typeReads === 3)) {
      field.setAttributeNS(null, 'name', 'renamed'); trace.push('renamed');
    }
    if ((effect === 'throw-second' && typeReads === 2) || (effect === 'throw-third' && typeReads === 3)) throw marker;
    if (effect === 'switch-checkbox-to-radio' && type === 'checkbox' && typeReads === 3) {
      checkedState = false; trace.push('unchecked'); return 'radio';
    }
    return type;
  } });
  Object.defineProperty(field, '_checkedness', { configurable: true,
    get() { trace.push(`checked:${checkedState}`); if (effect === 'checked-throw') throw marker; return checkedState; },
    set(value) { checkedState = value; trace.push(`checked-set:${value}`); },
  });
  const outcome = { trace };
  try { outcome.entries = Array.from(new dom.window.FormData(form)); }
  catch (error) { outcome.error = { name: error?.name, message: error?.message, sameError: error === marker, sameCause: error?.cause === cause }; }
  finally { dom.window.close(); }
  return outcome;
}
module.exports = { observe, implementation };