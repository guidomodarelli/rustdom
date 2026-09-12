/** @module rustdom/multipart Parses multipart bodies independently of mutable browser File globals. */
'use strict';
const { MIMEType } = require('node:util');
const { parseMultipart } = require('@remix-run/multipart-parser');
/** Decode buffered non-multipart bodies with the native parser, isolated from user streams and mutable globals. */
const NativeResponse = globalThis.Response;
const nativeFormData = NativeResponse.prototype.formData;
/** Request.formData has no application upload quota; preserve that contract. */
const BODY_PARSER_OPTIONS = {
  maxHeaderSize: Infinity, maxFileSize: Infinity, maxParts: Infinity, maxTotalSize: Infinity,
};

/**
 * Consume a Request/Response once using explicit constructors from its browser realm.
 * @param {Request|Response} body - A native body owner.
 * @param {Function} readBytes - Intrinsic native body reader, unaffected by instance overrides.
 * @param {Function} getRealm - Resolve live FormData/File constructors after asynchronous consumption.
 * @param {Function} createTypeError - Build a local consumption/parser error in the execution realm.
 * @returns {Promise<FormData>} Decoded values with filenames and binary content preserved.
 * @throws {TypeError} When a body is malformed, already consumed, or its environment has been disposed.
 */
async function readFormData(body, readBytes, getRealm, createTypeError) {
  if (body.bodyUsed || body.body?.locked) {
    throw createTypeError('Body is unusable: Body has already been read');
  }
  // Rejections from the caller's stream must retain their exact identity, even when they are TypeErrors.
  const bytes = await readBytes.call(body);
  // Native formData observes current MIME metadata after consumption; read caller properties outside parser catches.
  const contentType = body.headers.get('content-type');
  let mime;
  try { mime = new MIMEType(contentType || ''); }
  catch { /* Preserve the native reader's invalid-content-type rejection below. */ }
  if (mime?.essence === 'application/x-www-form-urlencoded') {
    const isolated = new NativeResponse(bytes, { headers: { 'content-type': contentType } });
    // Even this parser can invoke a user-modified native FormData method; preserve its rejected value.
    const parsed = await nativeFormData.call(isolated);
    const { FormData } = getRealm();
    const result = new FormData();
    parsed.forEach((value, name) => result.append(name, value));
    return result;
  }
  if (mime?.essence !== 'multipart/form-data') {
    throw createTypeError('Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".');
  }
  const boundary = mime.params.get('boundary');
  if (!boundary) throw createTypeError('rustdom formData: multipart boundary is missing');
  const { FormData, File } = getRealm();
  const result = new FormData();
  try {
    for (const part of parseMultipart(new Uint8Array(bytes), { ...BODY_PARSER_OPTIONS, boundary })) {
      if (part.name === undefined) throw new TypeError('multipart part has no field name');
      if (part.filename !== undefined) result.append(part.name,
        new File([part.bytes], part.filename, { type: part.mediaType || 'application/octet-stream' }));
      else result.append(part.name, part.text);
    }
  } catch (error) {
    throw createTypeError('rustdom formData: malformed multipart body', error);
  }
  return result;
}

module.exports = { readFormData };
