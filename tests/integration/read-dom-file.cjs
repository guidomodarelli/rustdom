/** @module rustdom/test/read-dom-file Shares the public FileReader contract with installed-package consumers. */
'use strict';

/**
 * Read a File with the exposed DOM API, including its real brand check.
 * @param {object} realm - Browser globals owning the FileReader constructor.
 * @param {File} file - Decoded browser File to inspect.
 * @returns {Promise<number[]>} Original byte values, independent of ArrayBuffer realm identity.
 */
function readDomFile(realm, file) {
  return new Promise((resolve, reject) => {
    const reader = new realm.FileReader();
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result)));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

module.exports = { readDomFile };
