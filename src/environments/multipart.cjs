/** @module rustdom/multipart Parses multipart bodies independently of mutable browser File globals. */
'use strict';
const { File } = require('node:buffer');
const { MIMEType } = require('node:util');
const { parseMultipart } = require('@remix-run/multipart-parser');
const NativeFormData = globalThis.FormData;
/** Request.formData has no application upload quota; preserve that contract. */
const BODY_PARSER_OPTIONS = {
  maxHeaderSize: Infinity, maxFileSize: Infinity, maxParts: Infinity, maxTotalSize: Infinity,
};

/**
 * Consume a Request/Response once and build real native Files with an explicit constructor.
 * @param {Request|Response} body - A native body owner.
 * @param {Function} original - Native formData method for non-multipart media types.
 * @returns {Promise<FormData>} Decoded values with filenames and binary content preserved.
 * @throws {TypeError} When a multipart body is malformed or has already been consumed.
 */
async function readFormData(body, original) {
  let mime;
  try { mime = new MIMEType(body.headers.get('content-type') || ''); }
  catch { return original.call(body); }
  if (mime.essence !== 'multipart/form-data') return original.call(body);
  const bytes = new Uint8Array(await body.arrayBuffer());
  const boundary = mime.params.get('boundary');
  if (!boundary) throw new TypeError('rustdom formData: multipart boundary is missing');
  const result = new NativeFormData();
  try {
    for (const part of parseMultipart(bytes, { ...BODY_PARSER_OPTIONS, boundary })) {
      if (part.name === undefined) throw new TypeError('multipart part has no field name');
      if (part.filename !== undefined) result.append(part.name,
        new File([part.bytes], part.filename, { type: part.mediaType || 'application/octet-stream' }));
      else result.append(part.name, part.text);
    }
  } catch (error) {
    throw new TypeError('rustdom formData: malformed multipart body', { cause: error });
  }
  return result;
}

module.exports = { readFormData };
