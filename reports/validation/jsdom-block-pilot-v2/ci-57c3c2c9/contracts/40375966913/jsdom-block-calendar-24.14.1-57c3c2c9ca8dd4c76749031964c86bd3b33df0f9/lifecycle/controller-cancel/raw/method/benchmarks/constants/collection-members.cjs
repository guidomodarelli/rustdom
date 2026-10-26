/** @module benchmarks/constants/collection-members Fixed public member-lookup and property-enumeration workloads. */
'use strict';
const COLLECTION_MEMBER_LOOKUP_ITERATIONS = 100;
const COLLECTION_MEMBER_ENUMERATION_ITERATIONS = 10;
const COLLECTION_MEMBER_WORKLOADS = ['collection-named-hit', 'collection-named-miss', 'collection-property-names'];
module.exports = { COLLECTION_MEMBER_LOOKUP_ITERATIONS, COLLECTION_MEMBER_ENUMERATION_ITERATIONS, COLLECTION_MEMBER_WORKLOADS };
