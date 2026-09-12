/** @module rustdom/window Creates a configured window shared by normal and VM Vitest pools. */
'use strict';

const runtime = require('../../dist/index.cjs');
const { createWebPlatformBridge } = require('./web-platform.cjs');
const { releaseResources } = require('./lifecycle.cjs');
/** Invoke the owned close operation without looking up its mutable public property. */
const apply = Reflect.apply;
/** Keep browser defaults consistent across Vitest execution modes. */
const DEFAULT_HTML = '<!doctype html>';
const DEFAULT_URL = 'http://localhost:3000';
/** Capture host primitives before an environment replaces browser globals. */
const hostGlobals = Object.fromEntries([
  'Buffer', 'fetch', 'Response', 'Headers', 'URLSearchParams', 'structuredClone',
  'BroadcastChannel', 'MessageChannel', 'MessagePort', 'TextEncoder', 'TextDecoder',
  'ReadableStream', 'WritableStream', 'TransformStream',
].filter((name) => globalThis[name] !== undefined).map((name) => [name, globalThis[name]]));

/**
 * Create a real VM-capable JSDOM with Vitest-compatible options and tracked Web API resources.
 * @param {object} options - Vitest environmentOptions.
 * @param {Function} [executionTypeError] - Original normal-worker TypeError; VM workers use their fresh window intrinsic.
 * @returns {{dom: object, bridge: object, managedGlobalNames: string[], close: Function}} Owned resources and an idempotent intrinsic close.
 */
function createWindow(options = {}, executionTypeError) {
  const { html = DEFAULT_HTML, url = DEFAULT_URL, runScripts = 'dangerously',
    pretendToBeVisual = true, cookieJar, userAgent, resources,
    console: forwardConsole, beforeParse: requestedBeforeParse, ...rest } = options.jsdom || {};
  const virtualConsole = forwardConsole ? new runtime.VirtualConsole().forwardTo(globalThis.console) : rest.virtualConsole;
  let initializingWindow;
  let originalClose;
  let bridge;
  let beforeParseCallback = requestedBeforeParse;

  /** @returns {void} Releases bridge resources and closes the original Window, even if either operation fails. */
  function close() {
    if (!initializingWindow) return;
    let closingWindow = initializingWindow;
    let closingMethod = originalClose;
    let closingBridge = bridge;
    initializingWindow = null;
    originalClose = null;
    bridge = null;
    try {
      releaseResources([() => closingBridge?.dispose(), () => apply(closingMethod, closingWindow, [])]);
    } finally {
      closingWindow = null;
      closingMethod = null;
      closingBridge = null;
      beforeParseCallback = null;
      executionTypeError = null;
    }
  }
  try {
    const dom = new runtime.JSDOM(html, {
      ...rest, url, runScripts, pretendToBeVisual, virtualConsole,
      resources: resources ?? (userAgent ? new runtime.ResourceLoader({ userAgent }) : undefined),
      cookieJar: cookieJar === true ? new runtime.CookieJar() : cookieJar || undefined,
      /** @param {Window} window - The unparsed realm. @returns {void} Installs APIs before user initialization. */
      beforeParse(window) {
        initializingWindow = window;
        originalClose = window.close;
        bridge = createWebPlatformBridge(window, executionTypeError ?? window.TypeError);
        Object.assign(window, hostGlobals, bridge.globals);
        if (beforeParseCallback !== undefined) beforeParseCallback(window);
      },
    });
    const managedGlobalNames = [...new Set([...Object.keys(hostGlobals), ...Object.keys(bridge.globals)])];
    beforeParseCallback = null;
    executionTypeError = null;
    return { dom, bridge, managedGlobalNames, close };
  } catch (error) {
    releaseResources([close], [error]);
  }
}

module.exports = { createWindow };
