/** @file Declares one XML measurement with complete observed build and runtime inputs. */
'use strict';
module.exports = {
  revision: 'xml-full-inputs-v1',
  nodeVersions: ['v22.12.0', 'v24.14.1'],
  measurementNode: 'v24.14.1',
  candidateSourceHash: '0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9',
  cpu: 0,
  maxOutputBytes: 8 * 1024 * 1024,
  forbiddenEnvironment: ['NODE_OPTIONS', 'NODE_PATH', 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS'],
};
