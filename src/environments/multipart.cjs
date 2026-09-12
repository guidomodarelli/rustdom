/** @module rustdom/multipart Parses multipart bodies independently of mutable browser File globals. */
'use strict';
const { MIMEType } = require('node:util');
const { parseMultipart } = require('@remix-run/multipart-parser');
/** Request.formData has no application upload quota; preserve that contract. */
const BODY_PARSER_OPTIONS = {
  maxHeaderSize: Infinity, maxFileSize: Infinity, maxParts: Infinity, maxTotalSize: Infinity,
};

/**
 * Consume a Request/Response once using explicit constructors from its browser realm.
 * @param {Request|Response} body - A native body owner.
 * @param {Function} original - Native formData method for non-multipart media types.
 * @param {Function} getRealm - Resolve live FormData/File constructors after asynchronous consumption.
 * @returns {Promise<FormData>} Decoded values with filenames and binary content preserved.
 * @throws {TypeError} When a body is malformed, already consumed, or its environment has been disposed.
 */
async function readFormData(body, original, getRealm) {
  let mime;
  try { mime = new MIMEType(body.headers.get('content-type') || ''); }
  catch { /* Preserve the native reader's invalid-content-type rejection below. */ }
  if (mime?.essence !== 'multipart/form-data') {
    const parsed = await original.call(body);
    const { FormData } = getRealm();
    const result = new FormData();
    parsed.forEach((value, name) => result.append(name, value));
    return result;
  }
  const bytes = new Uint8Array(await body.arrayBuffer());
  const boundary = mime.params.get('boundary');
  if (!boundary) throw new TypeError('rustdom formData: multipart boundary is missing');
  const { FormData, File } = getRealm();
  const result = new FormData();
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
