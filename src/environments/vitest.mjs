/** @module rustdom/vitest Installs DOM globals with reversible descriptor restoration. */
import { populateGlobal } from 'vitest/runtime';
import { createRequire } from 'node:module';

/** Load shared window creation through Node rather than Vite's ESM evaluator. */
const { createWindow } = createRequire(import.meta.url)('./window.cjs');
/** Reuse the same precise exception routing in normal and VM pools. */
const { forwardWindowErrors } = createRequire(import.meta.url)('./window-errors.cjs');

/**
 * Restore partial global changes if a nonconfigurable host property rejects setup.
 * @param {object} global - Worker global receiving browser properties.
 * @param {Window} window - Isolated window to expose.
 * @param {object} dom - Public JSDOM instance exposed to the runner.
 * @param {object} additionalGlobals - Native-compatible Web APIs to install.
 * @returns {object} Official Vitest keys and original descriptors.
 * @throws {TypeError} Preserves the original global-installation failure after rollback.
 */
function installGlobals(global, window, dom, additionalGlobals) {
  const before = Object.getOwnPropertyDescriptors(global);
  try {
    const installed = populateGlobal(global, window, { bindFunctions: true });
    Object.defineProperty(global, 'jsdom', { configurable: true, writable: true, value: dom });
    for (const [name, value] of Object.entries(additionalGlobals)) {
      Object.defineProperty(global, name, { configurable: true, writable: true, value });
    }
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
   * Provide a real JSDOM VM context to Vitest's VM worker pools.
   * @param {object} options - Vitest environmentOptions.
   * @returns {object} VM access and an idempotent teardown.
   */
  setupVM(options) {
    let { dom, bridge } = createWindow(options);
    let stopErrorForwarding = forwardWindowErrors(dom.window);
    try {
      dom.window.jsdom = dom;
      dom.getInternalVMContext();
    } catch (error) {
      stopErrorForwarding();
      bridge.dispose();
      dom.window.close();
      throw error;
    }
    return {
      /** @returns {object} The context used to execute user tests. */
      getVmContext() { return dom?.getInternalVMContext(); },
      /** @returns {void} Releases timers, abort links, URLs, and the VM owner. */
      teardown() {
        if (!dom) return;
        try {
          stopErrorForwarding();
          bridge.dispose();
          delete dom.window.jsdom;
          dom.window.close();
        } finally {
          dom = null;
          bridge = null;
          stopErrorForwarding = null;
        }
      },
    };
  },
  /**
   * Create an isolated window for a Vitest worker's test file.
   * @param {object} global - Worker global to populate with browser properties.
   * @param {object} options - Vitest environmentOptions; accepts the usual jsdom key.
   * @returns {object} A teardown hook that restores globals and closes resources.
   */
  setup(global, options) {
    let { dom, bridge } = createWindow(options);
    let stopErrorForwarding = forwardWindowErrors(dom.window);
    // populateGlobal rewrites these aliases but does not retain their descriptors.
    const aliases = new Map(['window', 'self', 'top', 'parent', 'global', ...Object.keys(bridge.globals)].map((key) =>
      [key, Object.getOwnPropertyDescriptor(global, key)]));
    const previousJsdom = Object.getOwnPropertyDescriptor(global, 'jsdom');
    let installed;
    try {
      installed = installGlobals(global, dom.window, dom, bridge.globals);
    } catch (error) {
      stopErrorForwarding();
      bridge.dispose();
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
          bridge.dispose();
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
          bridge = null;
          stopErrorForwarding = null;
          keys.clear();
          originals.clear();
          aliases.clear();
        }
      },
    };
  },
};
