/** @module xml-build-contracts Declares artifact paths and bounded source/identity verification fixtures. */
'use strict';
const original = require('./current-build-contracts.cjs');
module.exports = { ...original, sourceInputsDirectoryPrefix: 'rustdom-xml-build-inputs-',
  preparationDirectoryPrefix: 'rustdom-xml-preparation-', relocatedReportPrefix: 'xml-relocated-', functionalReports: [
    { filename: 'xml-node22.json', node: 'v22.12.0' }, { filename: 'xml-node24.json', node: 'v24.14.1' },
  ] };
