/** @file Declares one XML measurement with complete observed build and runtime inputs. */
'use strict';
module.exports = {
  revision: 'xml-full-inputs-v1',
  nodeVersions: ['v22.12.0', 'v24.14.1'],
  measurementNode: 'v24.14.1',
  candidateSourceHash: '5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806',
  cpu: 0,
  maxOutputBytes: 8 * 1024 * 1024,
  forbiddenEnvironment: ['NODE_OPTIONS', 'NODE_PATH', 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS'],
};
