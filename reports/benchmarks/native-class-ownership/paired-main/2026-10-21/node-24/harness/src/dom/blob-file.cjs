/** @file Buffer/realm interop around native Blob byte construction, text rules and metadata. */
'use strict';
const { NativeBlobMetadata, normalizeBlobEndings, blobSliceRange, concatenateBlobBuffers } = require('../../dist/native.cjs');

/** @param {object} Blob - Actual WebIDL factory. @param {Function} isArrayBuffer - Existing cross-realm predicate. @returns {Function} Private Blob implementation. */
function createBlobImplementation(Blob, isArrayBuffer) {
  return class BlobImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - Converted parts and property bag. */
    constructor(globalObject, args) {
      const [parts, properties] = args; const buffers = [];
      if (parts !== undefined) for (const part of parts) {
        if (isArrayBuffer(part)) buffers.push(Buffer.from(part));
        else if (ArrayBuffer.isView(part)) buffers.push(Buffer.from(part.buffer, part.byteOffset, part.byteLength));
        else if (Blob.isImpl(part)) buffers.push(part._buffer);
        else buffers.push(Buffer.from(properties.endings === 'native' ? normalizeBlobEndings(part) : part));
      }
      // Finish all observable view getters before native code acquires byte pointers.
      this._buffer = concatenateBlobBuffers(buffers, Buffer); this._globalObject = globalObject;
      this._blob = new NativeBlobMetadata(properties.type);
    }
    /** @returns {number} Length of the actual interop Buffer, including assignments made by FormData. */
    get size() { return this._buffer.length; }
    /** @returns {string} Native normalized MIME type. */
    get type() { return this._blob.mimeType; }
    /** @param {number|undefined} start - Converted endpoint. @param {number|undefined} end - Converted endpoint. @param {string|undefined} contentType - Converted type. @returns {object} Realm-specific Blob sharing the platform buffer view. */
    slice(start, end, contentType) {
      const range = blobSliceRange(this.size, start, end);
      const buffer = this._buffer.slice(range.start, range.end);
      const blob = Blob.createImpl(this._globalObject, [[], { type: contentType === undefined ? '' : contentType }], {});
      blob._buffer = buffer; return blob;
    }
  };
}

/** @param {Function} BlobImpl - Shared base implementation for branding and bytes. @returns {Function} File metadata adapter. */
function createFileImplementation(BlobImpl) {
  return class FileImpl extends BlobImpl {
    /** @param {object} globalObject - Creation realm. @param {unknown[]} args - Converted file inputs. @param {object} privateData - Existing factory context. */
    constructor(globalObject, [parts, name, options], privateData) {
      super(globalObject, [parts, options], privateData);
      this._blob.setFile(name, 'lastModified' in options ? options.lastModified : Date.now());
    }
    /** @returns {string} Native file name. */
    get name() { return this._blob.fileName; }
    /** @returns {number} Native modification timestamp. */
    get lastModified() { return this._blob.lastModified; }
  };
}
module.exports = { createBlobImplementation, createFileImplementation };
