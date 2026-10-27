/** @module scripts/constants/migration-inventory Defines the versioned inventory scope and host boundaries. */
'use strict';

/** Keep implementation states and observation origins consistent across producers and consumers. */
const IMPLEMENTATION_STATE = { rustComplete: 'rust-complete', hybrid: 'hybrid', pending: 'pending' };
const SURFACE_ORIGIN = { packageExport: 'package-export', windowOwn: 'window-own', windowConstructor: 'window-constructor',
  windowPrototype: 'window-prototype', instance: 'unforgeable-instance', windowNamespace: 'window-namespace' };
const SURFACE_EXCLUSION = { privateHost: 'private-host-member', ecmascriptGlobal: 'ecmascript-host-global' };
const INVENTORY_ID_PREFIX = { module: 'module:', api: 'api:', unit: 'unit:' };

module.exports = {
  IMPLEMENTATION_STATE, SURFACE_ORIGIN, SURFACE_EXCLUSION, INVENTORY_ID_PREFIX,
  INVENTORY_SCHEMA_VERSION: 1,
  REFERENCE_SOURCE_DIRECTORY: 'lib',
  REFERENCE_GENERATED_DIRECTORY: 'lib/jsdom/living/generated/',
  REFERENCE_GLOBALS_FILE: 'lib/jsdom/browser/js-globals.json',
  REFERENCE_WINDOW_FILE: 'lib/jsdom/browser/Window.js',
  DEFAULT_INVENTORY_DIRECTORY: 'reports/progress/inventory',
  DEFAULT_INVENTORY_AUDITS_FILE: 'reports/progress/inventory/audits.json',
  JSDOM_EXPORT_MODULES: { JSDOM: 'lib/api.js', CookieJar: 'lib/api.js', toughCookie: 'lib/api.js',
    VirtualConsole: 'lib/jsdom/virtual-console.js', ResourceLoader: 'lib/jsdom/browser/resources/resource-loader.js' },
  IMPLEMENTATION_STATES: [IMPLEMENTATION_STATE.rustComplete, IMPLEMENTATION_STATE.hybrid, IMPLEMENTATION_STATE.pending],
  INVENTORY_MEMORY_TIMEOUT_MS: 30_000,
  INVENTORY_CLI_TIMEOUT_MS: 30_000,
  INSTANCE_SURFACE_PROBES: [
    { interface: 'Document', path: ['document'] },
    { interface: 'Location', path: ['location'] },
    { interface: 'History', path: ['history'] },
    { interface: 'Navigator', path: ['navigator'] },
    { interface: 'Screen', path: ['screen'] },
    { interface: 'Performance', path: ['performance'] },
    { interface: 'CustomElementRegistry', path: ['customElements'] },
    { interface: 'Storage', path: ['localStorage'] },
  ],
  SURFACE_DOCUMENT_URL: 'https://rustdom-inventory.invalid/',
  PUBLIC_FUNCTION_INTRINSIC_MEMBERS: ['name', 'length', 'prototype', 'caller', 'arguments'],
  WINDOW_NAMESPACE_PROBES: ['console', 'CSS'],
  INVENTORY_OUTPUT_FILES: { reference: 'reference.json', surface: 'surface.json', units: 'implementation-units.json',
    classification: 'classification.json', summary: 'summary.json' },
};
