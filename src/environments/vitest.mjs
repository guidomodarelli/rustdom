/** @module rustdom/vitest Installs DOM globals with reversible descriptor restoration. */
import { populateGlobal } from 'vitest/runtime';
import { createRequire } from 'node:module';

/** Load shared window creation through Node rather than Vite's ESM evaluator. */
const { createWindow } = createRequire(import.meta.url)('./window.cjs');
/** Reuse the same precise exception routing in normal and VM pools. */
const { forwardWindowErrors } = createRequire(import.meta.url)('./window-errors.cjs');
const { releaseResources } = createRequire(import.meta.url)('./lifecycle.cjs');
/** Capture the fallback before callbacks can replace or delete the normal worker's exposed TypeError. */
const HostTypeError = TypeError;

/**
 * Restore partial global changes if a nonconfigurable host property rejects setup.
 * @param {object} global - Worker global receiving browser properties.
 * @param {Window} window - Isolated window to expose.
 * @param {object} dom - Public JSDOM instance exposed to the runner.
 * @param {string[]} additionalKeys - Managed Web API names, including overrides and deletions.
 * @returns {object} Official Vitest keys and original descriptors.
 * @throws {TypeError} Preserves the original global-installation failure after rollback.
 */
function installGlobals(global, window, dom, additionalKeys) {
  const before = Object.getOwnPropertyDescriptors(global);
  const accessors = new Map();
  try {
    // Reserve managed names so populateGlobal does not evaluate or bind user-defined accessors.
    for (const name of additionalKeys) {
      if (!(name in global)) Object.defineProperty(global, name, { configurable: true, writable: true, value: undefined });
    }
    const installed = populateGlobal(global, window, { bindFunctions: true });
    Object.defineProperty(global, 'jsdom', { configurable: true, writable: true, value: dom });
    for (const name of additionalKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(window, name);
      if (descriptor && ('get' in descriptor || 'set' in descriptor)) {
        accessors.set(name, { owner: window, descriptor });
        Object.defineProperty(global, name, { configurable: true, enumerable: descriptor.enumerable,
          /** @returns {*} The accessor value using its original window receiver while active. */
          get: descriptor.get ? function () {
            const entry = accessors.get(name);
            return entry?.descriptor.get.call(entry.owner);
          } : undefined,
          /** @param {*} value - Assigned value. @returns {void} Calls the setter with its original receiver. */
          set: descriptor.set ? function (value) {
            const entry = accessors.get(name);
            entry?.descriptor.set.call(entry.owner, value);
          } : undefined,
        });
      } else if (descriptor) Object.defineProperty(global, name, { ...descriptor, configurable: true });
      else delete global[name];
    }
    return { ...installed,
      /** @returns {void} Releases accessor closures and their window even if callers retain the adapter functions. */
      disposeAccessors() { accessors.clear(); },
    };
  } catch (error) {
    accessors.clear();
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
    let { dom, bridge, close } = createWindow(options);
    let stopErrorForwarding;
    try {
      stopErrorForwarding = forwardWindowErrors(dom.window);
      dom.window.jsdom = dom;
      dom.getInternalVMContext();
    } catch (error) {
      releaseResources([stopErrorForwarding, close], [error]);
    }
    return {
      /** @returns {object} The context used to execute user tests. */
      getVmContext() { return dom?.getInternalVMContext(); },
      /** @returns {void} Releases timers, abort links, URLs, and the VM owner. */
      teardown() {
        if (!dom) return;
        try {
          releaseResources([stopErrorForwarding, () => { delete dom.window.jsdom; }, close]);
        } finally {
          dom = null;
          bridge = null;
          stopErrorForwarding = null;
          close = null;
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
    const executionTypeError = global.TypeError ?? HostTypeError;
    let { dom, bridge, managedGlobalNames, close } = createWindow(options, executionTypeError);
    let stopErrorForwarding;
    // populateGlobal rewrites these aliases but does not retain their descriptors.
    const aliases = new Map(['window', 'self', 'top', 'parent', 'global', ...managedGlobalNames].map((key) =>
      [key, Object.getOwnPropertyDescriptor(global, key)]));
    const previousJsdom = Object.getOwnPropertyDescriptor(global, 'jsdom');
    let installed;
    try {
      stopErrorForwarding = forwardWindowErrors(dom.window);
      installed = installGlobals(global, dom.window, dom, managedGlobalNames);
    } catch (error) {
      releaseResources([stopErrorForwarding, close], [error]);
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
          releaseResources([stopErrorForwarding, close]);
        } finally {
          installed.disposeAccessors();
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
          close = null;
          installed = null;
          managedGlobalNames = null;
          keys.clear();
          originals.clear();
          aliases.clear();
        }
      },
    };
  },
};
