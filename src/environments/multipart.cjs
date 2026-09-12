/** @module rustdom/multipart Parses multipart bodies independently of mutable browser File globals. */
'use strict';
const { parseMultipart } = require('@remix-run/multipart-parser');
const { extractMimeType } = require('./mime-type.cjs');
/** Decode buffered non-multipart bodies with the native parser, isolated from user streams and mutable globals. */
const NativeResponse = globalThis.Response;
const nativeFormData = NativeResponse.prototype.formData;
/** Capture body/header state access and iteration before application globals or methods can be replaced. */
const nativeHeadersGet = globalThis.Headers.prototype.get;
const nativeStreamLocked = Object.getOwnPropertyDescriptor(globalThis.ReadableStream.prototype, 'locked').get;
const nativeFormDataForEach = globalThis.FormData.prototype.forEach;
const apply = Reflect.apply;
/** Request.formData has no application upload quota; preserve that contract. */
const BODY_PARSER_OPTIONS = {
  maxHeaderSize: Infinity, maxFileSize: Infinity, maxParts: Infinity, maxTotalSize: Infinity,
};

/**
 * Consume a Request/Response once using explicit constructors from its browser realm.
 * @param {Request|Response} body - A native body owner.
 * @param {object} intrinsics - Original native body reader and body/bodyUsed/headers getters.
 * @param {Function} getRealm - Resolve live FormData/File constructors after asynchronous consumption.
 * @param {Function} createTypeError - Build a local consumption/parser error in the execution realm.
 * @returns {Promise<FormData>} Decoded values with filenames and binary content preserved.
 * @throws {TypeError} When a body is malformed, already consumed, or its environment has been disposed.
 */
async function readFormData(body, intrinsics, getRealm, createTypeError) {
  const stream = apply(intrinsics.getBody, body, []);
  if (apply(intrinsics.getBodyUsed, body, []) || (stream !== null && apply(nativeStreamLocked, stream, []))) {
    throw createTypeError('Body is unusable: Body has already been read');
  }
  // Rejections from the caller's stream must retain their exact identity, even when they are TypeErrors.
  const bytes = await apply(intrinsics.readBytes, body, []);
  // Read the real, current header list after consumption without consulting shadow properties.
  const contentType = apply(nativeHeadersGet, apply(intrinsics.getHeaders, body, []), ['content-type']);
  const mime = extractMimeType(contentType);
  if (mime?.essence === 'application/x-www-form-urlencoded') {
    const isolated = new NativeResponse(bytes, { headers: { 'content-type': contentType } });
    // Even this parser can invoke a user-modified native FormData method; preserve its rejected value.
    const parsed = await apply(nativeFormData, isolated, []);
    const { FormData, append } = getRealm();
    const result = new FormData();
    apply(nativeFormDataForEach, parsed, [(value, name) => apply(append, result, [name, value])]);
    return result;
  }
  if (mime?.essence !== 'multipart/form-data') {
    throw createTypeError('Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".');
  }
  const boundary = mime.params.get('boundary');
  if (!boundary) throw createTypeError('rustdom formData: multipart boundary is missing');
  const { FormData, File, append } = getRealm();
  const result = new FormData();
  try {
    for (const part of parseMultipart(new Uint8Array(bytes), { ...BODY_PARSER_OPTIONS, boundary })) {
      if (part.name === undefined) throw createTypeError('multipart part has no field name');
      if (part.filename !== undefined) apply(append, result, [part.name,
        new File([part.bytes], part.filename, { type: part.mediaType || 'application/octet-stream' })]);
      else apply(append, result, [part.name, part.text]);
    }
  } catch (error) {
    throw createTypeError('rustdom formData: malformed multipart body', error);
  }
  return result;
}

module.exports = { readFormData };
