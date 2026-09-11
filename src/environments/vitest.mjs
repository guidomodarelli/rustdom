/** @module rustdom/vitest Installs DOM globals with reversible descriptor restoration. */
import { populateGlobal } from 'vitest/runtime';
import { createRequire } from 'node:module';

/** Load the native CommonJS runtime through Node rather than Vite's ESM evaluator. */
const runtime = createRequire(import.meta.url)('../../dist/index.cjs');

/**
 * Forward unhandled browser errors to Vitest's process error listener.
 * @param {Window} window - Newly created isolated browser window.
 * @returns {Function} Removes forwarding and restores listener methods.
 */
function forwardWindowErrors(window) {
  const add = window.addEventListener;
  const remove = window.removeEventListener;
  let userErrorListeners = 0;
  /**
   * Report browser exceptions unless test code registered its own error handler.
   * @param {ErrorEvent} event - Dispatched browser exception.
   * @returns {void} Forwards the original error to the runner.
   */
  function reportError(event) {
    if (userErrorListeners === 0 && event.error != null) {
      event.preventDefault();
      process.emit('uncaughtException', event.error);
    }
  }
  add.call(window, 'error', reportError);
  window.addEventListener = function (...args) {
    if (args[0] === 'error') userErrorListeners++;
    return add.apply(this, args);
  };
  window.removeEventListener = function (...args) {
    if (args[0] === 'error' && userErrorListeners > 0) userErrorListeners--;
    return remove.apply(this, args);
  };
  return () => {
    remove.call(window, 'error', reportError);
    window.addEventListener = add;
    window.removeEventListener = remove;
  };
}

/**
 * Restore partial global changes if a nonconfigurable host property rejects setup.
 * @param {object} global - Worker global receiving browser properties.
 * @param {Window} window - Isolated window to expose.
 * @param {object} dom - Public JSDOM instance exposed to the runner.
 * @returns {object} Official Vitest keys and original descriptors.
 * @throws {TypeError} Preserves the original global-installation failure after rollback.
 */
function installGlobals(global, window, dom) {
  const before = Object.getOwnPropertyDescriptors(global);
  try {
    const installed = populateGlobal(global, window, { bindFunctions: true });
    Object.defineProperty(global, 'jsdom', { configurable: true, writable: true, value: dom });
    return installed;
  } catch (error) {
    for (const key of Reflect.ownKeys(global)) {
      if (!Object.hasOwn(before, key)) delete global[key];
    }
    Object.defineProperties(global, before);
    throw error;
  }
}

/** Define the environment interface supported by Vitest 5 worker processes. */
export default {
  name: 'rustdom',
  viteEnvironment: 'client',
  /**
   * Create an isolated window for a Vitest worker's test file.
   * @param {object} global - Worker global to populate with browser properties.
   * @param {object} options - Vitest environmentOptions; accepts the usual jsdom key.
   * @returns {object} A teardown hook that restores globals and closes resources.
   */
  setup(global, options) {
    const { html = '<!doctype html>', ...jsdomOptions } = options.jsdom || {};
    let dom = new runtime.JSDOM(html, {
      pretendToBeVisual: true,
      url: 'http://localhost:3000',
      runScripts: 'dangerously',
      ...jsdomOptions,
    });
    let stopErrorForwarding = forwardWindowErrors(dom.window);
    // populateGlobal rewrites these aliases but does not retain their descriptors.
    const aliases = new Map(['window', 'self', 'top', 'parent', 'global'].map((key) =>
      [key, Object.getOwnPropertyDescriptor(global, key)]));
    const previousJsdom = Object.getOwnPropertyDescriptor(global, 'jsdom');
    let installed;
    try {
      installed = installGlobals(global, dom.window, dom);
    } catch (error) {
      stopErrorForwarding();
      dom.window.close();
      throw error;
    }
    const { keys, originals } = installed;
    return {
      /**
       * Close the window and restore every overwritten global descriptor.
       * @returns {void} Releases timers, event listeners, and DOM references.
       */
      teardown() {
        if (!dom) return;
        try {
          stopErrorForwarding();
          dom.window.close();
        } finally {
          for (const key of keys) delete global[key];
          for (const [key, descriptor] of originals) Object.defineProperty(global, key, descriptor);
          if (previousJsdom) Object.defineProperty(global, 'jsdom', previousJsdom);
          else delete global.jsdom;
          for (const [key, descriptor] of aliases) {
            if (descriptor) Object.defineProperty(global, key, descriptor);
            else delete global[key];
          }
          // The runner may retain this teardown callback after calling it.
          dom = null;
          stopErrorForwarding = null;
          keys.clear();
          originals.clear();
          aliases.clear();
        }
      },
    };
  },
};
