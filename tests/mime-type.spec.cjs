/** @file Compares HTTP MIME extraction with real native Fetch and preserves case-sensitive parameters. */
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { MIMEType } = require('node:util');
const { extractMimeType } = require('../src/environments/mime-type.cjs');

/** Capture the independent native Fetch implementation before browser environments publish globals. */
const NativeResponse = globalThis.Response;

/** Explicit HTTP fixtures cover selection, quoted lists, invalid entries, and charset inheritance. */
const MIME_FIXTURES = [
  { name: 'the header is absent', value: null, expected: null },
  { name: 'the header is empty', value: '', expected: null },
  { name: 'only spaces and tabs are present', value: ' \t ', expected: null },
  { name: 'only empty list entries are present', value: ', ,\t,', expected: null },
  { name: 'all entries are malformed', value: 'invalid, /html, text/, text /html', expected: null },
  { name: 'only the universal wildcard is present', value: '*/*;charset=gbk', expected: null },
  { name: 'a single MIME type is present', value: 'TEXT/HTML;CHARSET=UTF-8', expected: 'text/html;charset=UTF-8' },
  { name: 'a later valid type supersedes an earlier type', value: 'text/html, application/json', expected: 'application/json' },
  { name: 'invalid entries surround a valid type', value: 'invalid, text/html, /html,', expected: 'text/html' },
  { name: 'empty entries surround a valid type', value: ',\t,text/html, ,', expected: 'text/html' },
  { name: 'SP and HTAB surround each entry', value: ' text/plain \t,\t text/html \t', expected: 'text/html' },
  { name: 'nonbreaking space precedes a later type', value: 'text/plain,\u00a0text/html', expected: 'text/plain' },
  { name: 'nonbreaking space follows a later type', value: 'text/plain,text/html\u00a0', expected: 'text/plain' },
  { name: 'form feed precedes a later type', value: 'text/plain,\ftext/html', expected: 'text/plain' },
  { name: 'vertical tab follows a later type', value: 'text/plain,text/html\v', expected: 'text/plain' },
  { name: 'a quoted comma belongs to a boundary', value: 'text/plain, multipart/form-data; boundary="Aa,Bb"', expected: 'multipart/form-data;boundary="Aa,Bb"' },
  { name: 'a quoted comma precedes a later MIME type', value: 'multipart/form-data;boundary="Aa,Bb", text/html', expected: 'text/html' },
  { name: 'an escaped quote precedes a quoted comma', value: 'multipart/form-data;boundary="Aa\\",Bb",text/html', expected: 'text/html' },
  { name: 'an escaped quote remains within a boundary', value: 'text/html,multipart/form-data;boundary="Aa\\",Bb"', expected: 'multipart/form-data;boundary="Aa\\",Bb"' },
  { name: 'an escaped backslash precedes a closing quote', value: 'multipart/form-data;boundary="Aa\\\\",text/html', expected: 'text/html' },
  { name: 'an escaped comma remains within a boundary', value: 'multipart/form-data;boundary="Aa\\,Bb"', expected: 'multipart/form-data;boundary="Aa,Bb"' },
  { name: 'a backslash outside quotes does not escape a separator', value: 'invalid\\,text/html', expected: 'text/html' },
  { name: 'an unclosed quoted parameter includes the remaining comma', value: 'text/html;boundary="Aa,Bb,application/json', expected: 'text/html;boundary="Aa,Bb,application/json"' },
  { name: 'a trailing escape belongs to an unclosed quoted parameter', value: 'text/html;boundary="Aa\\', expected: 'text/html;boundary="Aa\\\\"' },
  { name: 'an invalid quoted entry contains a comma', value: '"invalid,entry",text/html', expected: 'text/html' },
  { name: 'an unclosed quote outside parameters absorbs a later type', value: 'text/html;",application/json', expected: 'text/html' },
  { name: 'the universal wildcard follows a valid type', value: 'text/html,*/*', expected: 'text/html' },
  { name: 'a subtype wildcard follows a valid type', value: 'text/html,application/*', expected: 'application/*' },
  { name: 'a type wildcard follows a valid type', value: 'text/html,*/json', expected: '*/json' },
  { name: 'the same essence has no later charset', value: 'text/html;charset=gbk,text/html', expected: 'text/html;charset=gbk' },
  { name: 'the same essence has a later explicit charset', value: 'text/html;charset=gbk,text/html;charset=UTF-8', expected: 'text/html;charset=UTF-8' },
  { name: 'a later explicit charset does not replace the remembered charset', value: 'text/html;charset=gbk,text/html;charset=UTF-8,text/html', expected: 'text/html;charset=gbk' },
  { name: 'the first occurrence has no charset to remember', value: 'text/html,text/html;charset=UTF-8,text/html', expected: 'text/html' },
  { name: 'a quoted empty charset is remembered', value: 'text/html;charset="",text/html', expected: 'text/html;charset=""' },
  { name: 'an explicit empty charset suppresses inheritance', value: 'text/html;charset=gbk,text/html;charset=""', expected: 'text/html;charset=""' },
  { name: 'an unquoted empty charset is discarded by MIME parsing', value: 'text/html;charset=gbk,text/html;charset=', expected: 'text/html;charset=gbk' },
  { name: 'duplicate charset parameters preserve the first value', value: 'text/html;charset=gbk;charset=UTF-8,text/html', expected: 'text/html;charset=gbk' },
  { name: 'MIME essence comparison ignores case', value: 'text/html;charset=gbk,TEXT/HTML', expected: 'text/html;charset=gbk' },
  { name: 'an essence change discards the preceding charset', value: 'text/html;charset=gbk,text/plain', expected: 'text/plain' },
  { name: 'an essence change remembers its new charset', value: 'text/html;charset=gbk,text/plain;charset=UTF-8,text/plain', expected: 'text/plain;charset=UTF-8' },
  { name: 'returning to an earlier essence does not restore its old charset', value: 'text/html;charset=gbk,text/plain,text/html', expected: 'text/html' },
  { name: 'invalid entries and universal wildcards do not reset the charset', value: 'text/html;charset=gbk,invalid,*/*;charset=UTF-8,text/html', expected: 'text/html;charset=gbk' },
  { name: 'a subtype wildcard resets the charset', value: 'text/html;charset=gbk,application/*,text/html', expected: 'text/html' },
  { name: 'other parameters are replaced while charset inherits', value: 'text/html;charset=gbk;a=b,text/html;x=y', expected: 'text/html;x=y;charset=gbk' },
  { name: 'a later multipart type does not inherit a boundary', value: 'multipart/form-data;boundary=AaBb,multipart/form-data', expected: 'multipart/form-data' },
  { name: 'a later boundary replaces the earlier boundary', value: 'multipart/form-data;boundary=Old,multipart/form-data;boundary=New', expected: 'multipart/form-data;boundary=New' },
];

// Compare list processing against native Fetch while separately checking the full MIME serialization.
describe('extractMimeType', () => {
  for (const fixture of MIME_FIXTURES) {
    test(`should extract the native MIME type when ${fixture.name}`, async () => {
      // Arrange: null bodies avoid Response's automatic Content-Type for string bodies.
      const headers = fixture.value === null ? {} : { 'content-type': fixture.value };
      const response = new NativeResponse(null, { headers });

      // Act.
      const actual = extractMimeType(response.headers.get('content-type'));
      const reference = await response.blob();

      // Assert: Blob lowercases its type, but multipart boundaries must retain their original case.
      assert.equal(actual?.toString() ?? null, fixture.expected);
      assert.equal(actual?.toString().toLowerCase() ?? '', reference.type);
      if (actual !== null) assert.ok(actual instanceof MIMEType);
    });
  }

  test('should preserve exact boundary and charset values when mixed-case parameters are selected', () => {
    // Arrange.
    const headerValue = 'multipart/form-data;CHARSET="Utf-8";boundary=Old,multipart/form-data;BOUNDARY="Aa,Bb"';

    // Act.
    const actual = extractMimeType(headerValue);

    // Assert.
    assert.equal(actual.essence, 'multipart/form-data');
    assert.equal(actual.params.get('boundary'), 'Aa,Bb');
    assert.equal(actual.params.get('charset'), 'Utf-8');
  });

  test('should select the last usable type when duplicate header fields are combined', async () => {
    // Arrange.
    const response = new NativeResponse(null, { headers: [
      ['content-type', 'text/html;charset=gbk'],
      ['content-type', 'invalid'],
      ['content-type', 'text/html;x=y'],
    ] });

    // Act.
    const actual = extractMimeType(response.headers.get('content-type'));
    const reference = await response.blob();

    // Assert.
    assert.equal(actual.toString(), 'text/html;x=y;charset=gbk');
    assert.equal(actual.toString().toLowerCase(), reference.type);
  });

  test('should isolate returned parameters when extraction is repeated and earlier results are mutated', () => {
    // Arrange.
    const headerValue = 'multipart/form-data;charset=gbk;boundary="Aa,Bb"';
    const previous = extractMimeType(headerValue);
    previous.params.set('boundary', 'Changed');
    previous.params.delete('charset');

    // Act and assert: calls do not retain earlier MIME objects or their mutable parameter state.
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const actual = extractMimeType(headerValue);
      assert.notEqual(actual, previous);
      assert.equal(actual.params.get('boundary'), 'Aa,Bb');
      assert.equal(actual.params.get('charset'), 'gbk');
    }
  });
});
