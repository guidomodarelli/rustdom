/** @file Host scheduling, realm outputs and event delivery around native FileReader control and text conversion. */
'use strict';
const { NativeFileReaderState, ReaderStringFormat, fileReaderString, fileReaderEncoding } = require('../../dist/native.cjs');

/** @param {object} context - Existing event, encoding and realm primitives. @returns {Function} Private reader implementation. */
function createFileReaderImplementation({ EventTargetImpl, DOMException, ProgressEvent, fireAnEvent, setupForSimpleEventAccessors, MIMEType, legacyHookDecode, copyToArrayBufferInNewRealm }) {
  class FileReaderImpl extends EventTargetImpl {
    /** @param {object} globalObject - Reader realm. @param {unknown[]} args - Constructor inputs. @param {object} privateData - Existing event context. */
    constructor(globalObject, args, privateData) {
      super(globalObject, args, privateData); this._reader = new NativeFileReaderState();
      this.error = null; this.result = null; this._globalObject = globalObject; this._ownerDocument = globalObject.document;
    }
    /** @returns {number} Native EMPTY/LOADING/DONE state. */
    get readyState() { return this._reader.readyState; }
    /** @param {object} file - Actual Blob implementation. @returns {void} */
    readAsArrayBuffer(file) { this._readFile(file, 'buffer'); }
    /** @param {object} file - Actual Blob implementation. @returns {void} */
    readAsBinaryString(file) { this._readFile(file, 'binaryString'); }
    /** @param {object} file - Actual Blob implementation. @returns {void} */
    readAsDataURL(file) { this._readFile(file, 'dataURL'); }
    /** @param {object} file - Actual Blob implementation. @param {string|undefined} label - Converted encoding label. @returns {void} */
    readAsText(file, label) { this._readFile(file, 'text', fileReaderEncoding(label)); }
    /** @returns {void} Native cancellation policy, with result ownership and actual events in the host. */
    abort() { const emit = this._reader.abort(); this.result = null; if (emit) { this._fireProgressEvent('abort'); this._fireProgressEvent('loadend'); } }
    /** @param {string} name - Event type. @param {object} [props] - Progress data. @returns {void} */
    _fireProgressEvent(name, props) { fireAnEvent(name, this, ProgressEvent, props); }
    /** @param {object} file - Actual Blob implementation. @param {string} format - Output mode. @param {string} [label] - Canonical encoding name. @returns {void} Preserve two real immediate tasks and the reference's shared abort flag. */
    _readFile(file, format, label) {
      if (!this._reader.begin()) throw DOMException.create(this._globalObject, ['The object is in an invalid state.', 'InvalidStateError']);
      setImmediate(() => {
        if (!this._reader.enterStage()) return;
        this._fireProgressEvent('loadstart'); const data = file._buffer || Buffer.alloc(0);
        this._fireProgressEvent('progress', { lengthComputable: !isNaN(file.size), total: file.size, loaded: data.length });
        setImmediate(() => {
          if (!this._reader.enterStage()) return;
          if (format === 'buffer') this.result = copyToArrayBufferInNewRealm(data, this._globalObject);
          else if (format === 'binaryString') this.result = fileReaderString(data, ReaderStringFormat.BinaryString) ?? data.toString('binary');
          else if (format === 'dataURL') {
            const type = String(MIMEType.parse(file.type) || 'application/octet-stream');
            this.result = fileReaderString(data, ReaderStringFormat.DataUrl, undefined, type) ?? `data:${type};base64,${data.toString('base64')}`;
          } else this.result = fileReaderString(data, ReaderStringFormat.Text, label) ?? legacyHookDecode(data, label);
          this._reader.finish(); this._fireProgressEvent('load'); this._fireProgressEvent('loadend');
        });
      });
    }
  }
  setupForSimpleEventAccessors(FileReaderImpl.prototype, ['loadstart', 'progress', 'load', 'abort', 'error', 'loadend']);
  return FileReaderImpl;
}
module.exports = { createFileReaderImplementation };
