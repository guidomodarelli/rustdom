/** @module rustdom/web-platform Bridges jsdom values to Node's Web APIs without retaining closed realms. */
'use strict';

const { Blob: NodeBlob, File: NodeFile } = require('node:buffer');
const { URL: NodeURL } = require('node:url');
const NodeRequest = globalThis.Request;
const NodeFormData = globalThis.FormData;
const NodeAbortController = globalThis.AbortController;
const NodeAbortSignal = globalThis.AbortSignal;
const NodeResponse = globalThis.Response;
/** Capture host diagnostics and signal operations before beforeParse or global population. */
const HostTypeError = TypeError;
const nativeSignalAdd = NodeAbortSignal.prototype.addEventListener;
const nativeSignalRemove = NodeAbortSignal.prototype.removeEventListener;
const apply = Reflect.apply;
const nodeFetch = globalThis.fetch;
const { readFormData } = require('./multipart.cjs');
const { releaseResources } = require('./lifecycle.cjs');
const { implForWrapper } = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/utils.js');
const DOMBlob = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/Blob.js');
const DOMFormData = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/FormData.js');
const DOMAbortSignal = require('../../dist/vendor-jsdom/lib/jsdom/living/generated/AbortSignal.js');

/** @param {Function} Constructor - Original native body constructor. @returns {object} Unbound intrinsic operations with native brand checks. */
function bodyIntrinsics(Constructor) {
  const prototype = Constructor.prototype;
  return { readBytes: prototype.arrayBuffer,
    getBody: Object.getOwnPropertyDescriptor(prototype, 'body').get,
    getBodyUsed: Object.getOwnPropertyDescriptor(prototype, 'bodyUsed').get,
    getHeaders: Object.getOwnPropertyDescriptor(prototype, 'headers').get };
}

/** Keep Request and Response operations separate so borrowed methods retain native brand checks. */
const nativeRequestBody = bodyIntrinsics(NodeRequest);
const nativeResponseBody = bodyIntrinsics(NodeResponse);

/**
 * Convert private jsdom Blob/File values while preserving bytes and MIME type.
 * @param {*} value - A body or object-URL input.
 * @returns {*} A native Blob for recognized jsdom values, otherwise the original value.
 */
function nativeBlob(value) {
  return DOMBlob.is(value) ? new NodeBlob([implForWrapper(value)._buffer], { type: value.type }) : value;
}

/**
 * Preserve multipart ordering, duplicate names, binary bytes, and filenames.
 * @param {*} body - Public Request body input.
 * @returns {*} A native body accepted by Node Request.
 */
function nativeBody(body) {
  if (!DOMFormData.is(body)) return nativeBlob(body);
  const converted = new NodeFormData();
  body.forEach((value, name) => {
    if (DOMBlob.is(value)) converted.append(name, new NodeFile([implForWrapper(value)._buffer], value.name,
      { type: value.type, lastModified: value.lastModified }));
    else converted.append(name, value);
  });
  return converted;
}

/**
 * Install per-window adapters and provide deterministic disposal of cross-realm links.
 * @param {Window} window - The actual jsdom window, before global aliases are installed.
 * @param {Function} executionTypeError - Original TypeError of the worker's execution realm.
 * @returns {{globals: object, dispose: Function}} Compatible globals and a resource disposer.
 */
function createWebPlatformBridge(window, executionTypeError) {
  const realmReference = new WeakRef(window);
  let WindowAbortController = window.AbortController;
  let eventTargetPrototype = window.EventTarget.prototype;
  let originalAdd = eventTargetPrototype.addEventListener;
  let originalRemove = eventTargetPrototype.removeEventListener;
  // Capture intrinsic constructors before beforeParse or test code can replace their public globals.
  let formDataRealm = { FormData: window.FormData, File: window.File,
    append: window.FormData.prototype.append, TypeError: executionTypeError };
  let toWindowSignals = new WeakMap();
  let toNodeSignals = new WeakMap();
  const connections = new Set();
  const objectUrls = new Set();
  const collectedSignals = new FinalizationRegistry((connection) => connections.delete(connection));

  /**
   * Resolve DOM constructors only when body consumption has finished.
   * @returns {object} Live FormData and File constructors.
   * @throws {TypeError} When teardown has released the destination realm.
   */
  function formDataConstructors() {
    if (!formDataRealm) throw formDataError('rustdom formData: environment has been disposed');
    return formDataRealm;
  }

  /**
   * Construct only errors whose consumption or parser provenance is controlled by the bridge.
   * @param {string} message - Description of the failed body operation.
   * @param {*} [cause] - Original parser error, when available.
   * @returns {TypeError} An error belonging to the current execution global.
   */
  function formDataError(message, cause) {
    // Resolve this only at the failure site; pending body reads must not capture a realm constructor.
    const ErrorConstructor = formDataRealm?.TypeError ?? HostTypeError;
    return new ErrorConstructor(message, cause === undefined ? undefined : { cause });
  }

  /**
   * Translate a real signal and detach its propagation listener during disposal.
   * @param {AbortSignal} source - Original signal from the other realm.
   * @param {Function} Controller - Constructor for the destination realm.
   * @param {WeakMap} cache - Per-window identity cache.
   * @returns {AbortSignal} A signal with preserved aborted state and reason.
   */
  function translateSignal(source, Controller, cache) {
    if (cache.has(source)) return cache.get(source);
    const controller = new Controller();
    cache.set(source, controller.signal);
    if (source.aborted) {
      controller.abort(source.reason);
      return controller.signal;
    }
    const sourceIsDOM = DOMAbortSignal.is(source);
    const connection = { source: new WeakRef(source), listener: null,
      remove: sourceIsDOM ? originalRemove : nativeSignalRemove };
    connection.listener = () => {
      controller.abort(connection.source.deref()?.reason);
      connections.delete(connection);
      collectedSignals.unregister(connection);
    };
    apply(sourceIsDOM ? originalAdd : nativeSignalAdd, source, ['abort', connection.listener, { once: true }]);
    connections.add(connection);
    collectedSignals.register(source, connection, connection);
    return controller.signal;
  }

  eventTargetPrototype.addEventListener = function (type, callback, options) {
    if (options && typeof options === 'object' && options.signal instanceof NodeAbortSignal) {
      const compatibleOptions = Object.create(options);
      Object.defineProperty(compatibleOptions, 'signal', {
        value: translateSignal(options.signal, WindowAbortController, toWindowSignals),
      });
      return originalAdd.call(this, type, callback, compatibleOptions);
    }
    return originalAdd.call(this, type, callback, options);
  };

  /** Accept jsdom bodies and signals while keeping native fetch semantics. */
  class Request extends NodeRequest {
    /**
     * Construct a native Request from browser-realm inputs.
     * @param {*} input - URL or existing Request.
     * @param {object} [init] - Native RequestInit options.
     */
    constructor(input, init) {
      if (arguments.length === 0) throw new HostTypeError('rustdom Request: a URL or Request argument is required');
      let options = init;
      if (init && typeof init === 'object') {
        const body = init.body;
        const signal = init.signal;
        const overrides = new Map();
        if (DOMBlob.is(body) || DOMFormData.is(body)) overrides.set('body', nativeBody(body));
        if (DOMAbortSignal.is(signal)) overrides.set('signal', translateSignal(signal, NodeAbortController, toNodeSignals));
        if (overrides.size) options = new Proxy(init, {
          get(target, property) { return overrides.has(property) ? overrides.get(property) : Reflect.get(target, property, target); },
        });
      }
      super(input instanceof NodeRequest ? input : new NodeURL(input, realmReference.deref()?.document?.baseURI), options);
    }

    /** @param {*} value - Candidate request. @returns {boolean} Whether Node recognizes it. */
    static [Symbol.hasInstance](value) { return value instanceof NodeRequest; }

    /** @returns {Promise<FormData>} FormData and Files from the originating realm while its environment remains active. */
    formData() { return readFormData(this, nativeRequestBody, formDataConstructors, formDataError); }

    /** @returns {Request} A native clone retaining the interoperable formData method. */
    clone() { return Object.setPrototypeOf(super.clone(), Request.prototype); }
  }

  /** Preserve native Response semantics while avoiding Node's mutable-global File dependency. */
  class Response extends NodeResponse {
    /** @param {*} body - Native or jsdom body. @param {object} [init] - Response options. */
    constructor(body, init) { super(nativeBody(body), init); }
    /** @returns {Promise<FormData>} Decoded fields and Files readable by the originating realm's FileReader. */
    formData() { return readFormData(this, nativeResponseBody, formDataConstructors, formDataError); }
    /** @returns {Response} A clone with the same body interoperability. */
    clone() { return Object.setPrototypeOf(super.clone(), Response.prototype); }
    /** @param {*} value - Candidate response. @returns {boolean} Whether it is a native Response. */
    static [Symbol.hasInstance](value) { return value instanceof NodeResponse; }
  }

  /**
   * Use the native transport with interoperable request inputs and response body readers.
   * @param {*} input - URL or Request.
   * @param {object} [init] - Request options.
   * @returns {Promise<Response>} A real native response with compatible multipart decoding.
   */
  async function fetch(input, init) {
    if (arguments.length === 0) throw new HostTypeError('rustdom fetch: a URL or Request argument is required');
    const response = await nodeFetch(new Request(input, init));
    return Object.setPrototypeOf(response, Response.prototype);
  }

  /** Track object URLs so teardown releases native Blob backing stores. */
  class URL extends NodeURL {
    /** @param {*} blob - Native or jsdom Blob. @returns {string} A native object URL. */
    static createObjectURL(blob) {
      const url = NodeURL.createObjectURL(nativeBlob(blob));
      objectUrls.add(url);
      return url;
    }

    /** @param {string} url - Previously created object URL. @returns {void} Releases its Blob. */
    static revokeObjectURL(url) {
      NodeURL.revokeObjectURL(url);
      objectUrls.delete(String(url));
    }

    /** @param {*} value - Candidate URL. @returns {boolean} Whether Node recognizes it. */
    static [Symbol.hasInstance](value) { return value instanceof NodeURL; }
  }

  return {
    globals: { Request, Response, fetch, URL, AbortController: NodeAbortController, AbortSignal: NodeAbortSignal },
    /** @returns {void} Removes listeners, clears caches, and revokes outstanding object URLs. */
    dispose() {
      if (!window) return;
      try {
        releaseResources([
          () => { eventTargetPrototype.addEventListener = originalAdd; },
          ...Array.from(connections, (connection) => () => {
            try {
              const source = connection.source.deref();
              if (source) apply(connection.remove, source, ['abort', connection.listener]);
            } finally { collectedSignals.unregister(connection); }
          }),
          ...Array.from(objectUrls, (url) => () => NodeURL.revokeObjectURL(url)),
        ]);
      } finally {
        connections.clear();
        toWindowSignals = new WeakMap();
        toNodeSignals = new WeakMap();
        objectUrls.clear();
        // Published classes may outlive teardown; release every original realm reference in their shared context.
        window = null;
        formDataRealm = null;
        executionTypeError = null;
        WindowAbortController = null;
        originalAdd = null;
        originalRemove = null;
        eventTargetPrototype = null;
      }
    },
  };
}

module.exports = { createWebPlatformBridge };
