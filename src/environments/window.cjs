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
].filter((name) => globalThis[name] !== undefined).map((name) => [name, globalThis[name]]));

/**
 * Create a real VM-capable JSDOM with Vitest-compatible options and tracked Web API resources.
 * @param {object} options - Vitest environmentOptions.
 * @returns {{dom: object, bridge: object}} The window owner and its resource bridge.
 */
function createWindow(options = {}) {
  const { html = DEFAULT_HTML, url = DEFAULT_URL, runScripts = 'dangerously',
    pretendToBeVisual = true, cookieJar, userAgent, resources,
    console: forwardConsole, ...rest } = options.jsdom || {};
  const virtualConsole = forwardConsole ? new runtime.VirtualConsole().forwardTo(globalThis.console) : rest.virtualConsole;
  const dom = new runtime.JSDOM(html, {
    ...rest, url, runScripts, pretendToBeVisual, virtualConsole,
    resources: resources ?? (userAgent ? new runtime.ResourceLoader({ userAgent }) : undefined),
    cookieJar: cookieJar === true ? new runtime.CookieJar() : cookieJar || undefined,
  });
  try {
    const bridge = createWebPlatformBridge(dom.window);
    Object.assign(dom.window, hostGlobals, bridge.globals);
    return { dom, bridge };
  } catch (error) {
    dom.window.close();
    throw error;
  }
}

module.exports = { createWindow };
