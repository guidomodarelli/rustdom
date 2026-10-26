/** @module benchmarks/constants/dom-parser Defines equivalent complete operations and bounded sampling. */
'use strict';
module.exports = {
  WARMUP_SAMPLES: 2,
  MEASURED_SAMPLES: 7,
  OPERATIONS_PER_SAMPLE: 100,
  ADJACENT_TEXT_COUNT: 100,
  BASELINE_UNDEFINED_MESSAGE: 'Failed to convert napi `utf16 string` into rust type `String`',
  HTML_MARKUP: '<!doctype html><main><p>text &amp; more</p><span data-id="value">tail</span></main>',
  XML_MARKUP: '<root xmlns="urn:root"><child>text &amp; more</child></root>',
  SCENARIOS: ['html', 'xml', 'xml-malformed', 'xml-undefined', 'whole-text', 'normalize'],
};
