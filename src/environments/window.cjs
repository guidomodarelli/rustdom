/** @module rustdom/window Creates a configured window shared by normal and VM Vitest pools. */
'use strict';

const runtime = require('../../dist/index.cjs');
const { createWebPlatformBridge } = require('./web-platform.cjs');
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
 * @returns {{dom: object, bridge: object}} The window owner and its resource bridge.
 */
function createWindow(options = {}) {
  const { html = DEFAULT_HTML, url = DEFAULT_URL, runScripts = 'dangerously',
    pretendToBeVisual = true, cookieJar, userAgent, resources,
    console: forwardConsole, beforeParse, ...rest } = options.jsdom || {};
  const virtualConsole = forwardConsole ? new runtime.VirtualConsole().forwardTo(globalThis.console) : rest.virtualConsole;
  let initializingWindow;
  let bridge;
  try {
    const dom = new runtime.JSDOM(html, {
      ...rest, url, runScripts, pretendToBeVisual, virtualConsole,
      resources: resources ?? (userAgent ? new runtime.ResourceLoader({ userAgent }) : undefined),
      cookieJar: cookieJar === true ? new runtime.CookieJar() : cookieJar || undefined,
      /** @param {Window} window - The unparsed realm. @returns {void} Installs APIs before user initialization. */
      beforeParse(window) {
        initializingWindow = window;
        bridge = createWebPlatformBridge(window);
        Object.assign(window, hostGlobals, bridge.globals);
        if (beforeParse !== undefined) beforeParse(window);
      },
    });
    return { dom, bridge };
  } catch (error) {
    try { bridge?.dispose(); }
    finally { initializingWindow?.close(); }
    throw error;
  }
}

module.exports = { createWindow };
