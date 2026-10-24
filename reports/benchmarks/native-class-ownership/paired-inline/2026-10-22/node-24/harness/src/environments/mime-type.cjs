/** @module rustdom/mime-type Extracts a MIME type from a combined HTTP Content-Type header. */
'use strict';
const { MIMEType } = require('node:util');

/**
 * Removes HTTP list whitespace with bounded scans, preserving other characters for MIME parsing.
 * @param {string} value - One raw header-list entry.
 * @returns {string} The entry without leading or trailing SP and HTAB.
 */
function trimHeaderValue(value) {
  let start = 0;
  let end = value.length;
  while (start < end && (value[start] === ' ' || value[start] === '\t')) start += 1;
  while (end > start && (value[end - 1] === ' ' || value[end - 1] === '\t')) end -= 1;
  return value.slice(start, end);
}

/**
 * Splits an HTTP header list without treating quoted or escaped commas as separators.
 * @param {string} headerValue - An already decoded, combined HTTP header value.
 * @returns {Generator<string>} Values in header order, including empty entries.
 */
function* splitHeaderValues(headerValue) {
  let valueStart = 0;
  let quoted = false;
  for (let position = 0; position < headerValue.length; position += 1) {
    const character = headerValue[position];
    if (quoted && character === '\\') {
      position += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ',' && !quoted) {
      yield trimHeaderValue(headerValue.slice(valueStart, position));
      valueStart = position + 1;
    }
  }
  yield trimHeaderValue(headerValue.slice(valueStart));
}

/**
 * Extracts Fetch's last usable MIME type while preserving its charset inheritance rules.
 * Only the first charset after an essence change is remembered; other parameters never inherit.
 * @param {string|null} headerValue - The combined Content-Type header, or null when absent.
 * @returns {MIMEType|null} The selected MIME type, or null when no usable value exists.
 * @see https://fetch.spec.whatwg.org/#concept-header-extract-mime-type
 */
function extractMimeType(headerValue) {
  if (headerValue === null) return null;
  let mimeType = null;
  let essence = null;
  let charset = null;
  for (const value of splitHeaderValues(headerValue)) {
    let candidate;
    try {
      candidate = new MIMEType(value);
    } catch {
      // Invalid list entries do not discard the preceding type or its remembered charset.
      continue;
    }
    if (candidate.essence === '*/*') continue;
    if (candidate.essence !== essence) {
      charset = candidate.params.get('charset');
      essence = candidate.essence;
    } else if (!candidate.params.has('charset') && charset !== null) {
      candidate.params.set('charset', charset);
    }
    mimeType = candidate;
  }
  return mimeType;
}

module.exports = { extractMimeType };
