/** @file Pinned diagnostics shared by Range bindings and native effect delivery. */
'use strict';
/** Preserve the original private comparator's diagnostic for inconsistent roots. */
const BOUNDARY_ROOT_ERROR_MESSAGE = 'Internal Error: Boundary points should have the same root!';
module.exports = { BOUNDARY_ROOT_ERROR_MESSAGE };
