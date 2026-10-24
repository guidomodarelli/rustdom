/** @module xml-build-recipe Preserves producer tools and resource contracts, with a separate source policy. */
'use strict';
const original = require('./current-hosted-build.cjs');
module.exports = { ...original, revision: 'xml-current-build-v1',
  preparationFiles: [...original.preparationFiles,
    '.github/workflows/xml-build.yml',
    'reports/benchmarks/native-class-ownership/constants/xml-history.json',
    'reports/benchmarks/native-class-ownership/constants/xml-build-inputs.cjs',
    'reports/benchmarks/native-class-ownership/constants/xml-build-contracts.cjs',
    'reports/benchmarks/native-class-ownership/constants/xml-hosted-build.cjs',
    'reports/benchmarks/native-class-ownership/xml-build-inputs.cjs',
    'reports/benchmarks/native-class-ownership/prepare-xml-hosted-build.cjs',
    'reports/benchmarks/native-class-ownership/xml-hosted-build-worker.cjs',
    'reports/benchmarks/native-class-ownership/xml-build-inputs.spec.cjs',
    'reports/benchmarks/native-class-ownership/prepare-xml-hosted-build.spec.cjs',
    'reports/benchmarks/native-class-ownership/XML-BUILD-PROTOCOL.md',
  ] };
