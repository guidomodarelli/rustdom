/** @file Verifies actual VM pool execution, React rendering, and browser/native API interoperation. */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, expect } from 'vitest';
import { createRequire } from 'node:module';

/** Exercise the same native/host distinction in both actual VM pools. */
const registerAbortSuite = createRequire(import.meta.url)('./abort-suite.cjs');
/** Each owned native DOM is independent of the VM's host-signal bridge. */
const { JSDOM } = createRequire(import.meta.url)('@rustdom/rustdom');
registerAbortSuite({ test, expect, runnerGlobal: globalThis, createNativeDom: () => new JSDOM('<!doctype html>') });

test('should run React updates inside the DOM VM realm', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  function Counter() {
    const [count, setCount] = React.useState(0);
    return React.createElement('button', { onClick: () => setCount(count + 1) }, `Count ${count}`);
  }
  try {
    await act(() => root.render(React.createElement(Counter)));
    await act(() => container.querySelector('button').click());
    expect(container.textContent).toBe('Count 1');
    expect(window).toBe(globalThis);
    expect(document.defaultView).toBe(window);
  } finally {
    await act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test('should bridge Blob bodies and Node abort signals inside a VM pool', async () => {
  const request = new Request('http://localhost', { method: 'POST', body: new Blob(['vm body']) });
  expect(await request.text()).toBe('vm body');
  const controller = new AbortController();
  controller.abort();
  const element = document.createElement('div');
  let called = false;
  element.addEventListener('click', () => { called = true; }, { signal: controller.signal });
  element.click();
  expect(called).toBe(false);
});
