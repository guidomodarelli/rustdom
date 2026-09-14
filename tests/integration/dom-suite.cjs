/** @module rustdom/integration Exercises real React, browser APIs, and user interaction in either runner. */
'use strict';

/**
 * Register the same public integration contracts in Jest and Vitest.
 * @param {object} runner - Test, expectation, and cleanup hooks supplied by the runner.
 * @returns {void} Registers integration tests using actual platform libraries.
 */
module.exports = function registerDomSuite({ test, expect, afterEach }) {
  const React = require('react');
  const { render, screen, cleanup } = require('@testing-library/react/pure');
  const userEvent = require('@testing-library/user-event').default;
  afterEach(() => { cleanup(); document.body.innerHTML = ''; });

  test('should preserve XML namespaces and escaping through the runner browser globals', () => {
    const xml = new DOMParser().parseFromString('<root xmlns="urn:r"><child a="&amp;"/></root>', 'text/xml');
    expect(new XMLSerializer().serializeToString(xml)).toBe('<root xmlns="urn:r"><child a="&amp;"/></root>');
    xml.documentElement.innerHTML = '<p:item xmlns:p="urn:p">&lt;</p:item>';
    expect(xml.documentElement.outerHTML).toBe('<root xmlns="urn:r"><p:item xmlns:p="urn:p">&lt;</p:item></root>');
    expect(xml.documentElement.innerHTML).toBe('<p:item xmlns:p="urn:p">&lt;</p:item>');
  });

  test('should render and update React state when a user clicks a button', async () => {
    /**
     * Render an accessible button backed by actual React state.
     * @returns {React.ReactElement} Interactive counter element.
     */
    function Counter() {
      const [count, setCount] = React.useState(0);
      return React.createElement('button', { onClick: () => setCount(count + 1) }, `Count ${count}`);
    }
    render(React.createElement(Counter));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Count 0' }));
    expect(screen.getByRole('button', { name: 'Count 1' }).textContent).toBe('Count 1');
  });

  test('should type into a controlled input when Testing Library dispatches keyboard events', async () => {
    /**
     * Render a controlled input and live output.
     * @returns {React.ReactElement} Input with observable React state.
     */
    function Form() {
      const [value, setValue] = React.useState('');
      return React.createElement('label', null, 'Name', React.createElement('input', {
        value, onChange: (event) => setValue(event.target.value),
      }), React.createElement('output', null, value));
    }
    render(React.createElement(Form));
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Name' }), 'Rust');
    expect(screen.getByRole('status').textContent).toBe('Rust');
  });

  test('should observe native-parsed fragments when MutationObserver watches a subtree', async () => {
    const records = [];
    const observer = new MutationObserver((mutations) => records.push(...mutations));
    observer.observe(document.body, { childList: true, subtree: true });
    document.body.innerHTML = '<section><button>Go</button></section>';
    await Promise.resolve();
    observer.disconnect();
    expect(records.some((record) => record.addedNodes.length > 0)).toBe(true);
    expect(document.querySelector('section > button').textContent).toBe('Go');
  });

  test('should preserve event capture and bubbling when a parsed button is clicked', () => {
    document.body.innerHTML = '<div><button>click</button></div>';
    const order = [];
    const parent = document.querySelector('div');
    const button = document.querySelector('button');
    parent.addEventListener('click', () => order.push('capture'), true);
    button.addEventListener('click', () => order.push('target'));
    parent.addEventListener('click', () => order.push('bubble'));
    button.click();
    expect(order).toEqual(['capture', 'target', 'bubble']);
    expect(button).toBe(document.querySelector('button'));
    expect(button instanceof HTMLElement).toBe(true);
  });

  test('should support custom elements and shadow DOM when definitions exist', () => {
    /** Render the component's connected callback into a real shadow root. */
    class Greeting extends HTMLElement {
      /** @returns {void} Creates the connected component content. */
      connectedCallback() {
        this.attachShadow({ mode: 'open' }).innerHTML = '<span>Hello</span>';
      }
    }
    customElements.define('rustdom-greeting', Greeting);
    document.body.innerHTML = '<rustdom-greeting></rustdom-greeting>';
    expect(document.querySelector('rustdom-greeting').shadowRoot.textContent).toBe('Hello');
  });

  test('should preserve URL storage and CSS semantics when browser APIs are used', () => {
    document.body.innerHTML = '<a href="/path">go</a><p style="color: rgb(255, 0, 0)">red</p>';
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
    localStorage.removeItem('test');
    expect(new URL(document.querySelector('a').href).pathname).toBe('/path');
    expect(getComputedStyle(document.querySelector('p')).color).toBe('rgb(255, 0, 0)');
  });
};
