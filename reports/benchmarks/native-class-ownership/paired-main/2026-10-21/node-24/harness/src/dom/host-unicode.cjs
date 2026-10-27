/** @module rustdom/host-unicode Transfers host ICU case data once for unbundled Unicode profiles. */
'use strict';
/** Use a fresh intrinsic realm so application String prototype changes cannot corrupt the profile. */
const { runInNewContext } = require('node:vm');
/** Copy the numeric result out of its temporary realm before caching it. */
const HostUint32Array = Uint32Array;
/** Keep application prototype properties outside the temporary intrinsic realm. */
const createObject = Object.create;
/** Cache exactly one host table per module instance, independent of reported version strings. */
let hostCaseChanges;

/**
 * Obtain the host's lowercase-change scalar set using its actual ICU intrinsics.
 * @returns {Uint32Array} A sorted private scalar set, shared only between native initializations.
 */
function getHostCaseChanges() {
  if (hostCaseChanges === undefined) {
    const changes = runInNewContext(`(() => {
      const changes = [];
      const lastScalar = 0x10ffff;
      for (let codepoint = 0; codepoint <= lastScalar; codepoint++) {
        if (codepoint >= 0xd800 && codepoint <= 0xdfff) continue;
        const character = String.fromCodePoint(codepoint);
        if (character.toLowerCase() !== character) changes.push(codepoint);
      }
      return new Uint32Array(changes);
    })()`, createObject(null));
    hostCaseChanges = new HostUint32Array(changes);
  }
  return hostCaseChanges;
}

/**
 * Initialize one native forest with bundled data or the real host's fallback table.
 * @param {object} arena - NativeTree that owns case filtering and node storage.
 * @param {string|undefined} version - Host-reported Unicode data version, when available.
 * @returns {void} Installs a profile without retaining the arena in the module cache.
 */
function initializeHostUnicode(arena, version) {
  if (typeof version !== 'string' || !arena.trySetUnicodeVersion(version)) {
    arena.setHostUnicodeCaseChanges(getHostCaseChanges().buffer);
  }
}

module.exports = { initializeHostUnicode };
