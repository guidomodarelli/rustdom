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

  test('should preserve storage order, UTF16 and independent storage types through runner globals', () => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('a', '🦀'); localStorage.setItem('b', 'second'); localStorage.setItem('a', 'changed');
    expect(localStorage.key(0)).toBe('a'); expect(sessionStorage.getItem('a')).toBe(null);
    localStorage.removeItem('a'); localStorage.setItem('a', '\ud800');
    expect(localStorage.key(1)).toBe('a'); expect(localStorage.getItem('a')).toBe('\ud800');
    localStorage.clear(); expect(localStorage.length).toBe(0);
  });

  test('should read current canonical attributes through selectors and serialization after mutation', () => {
    const element = document.createElement('div'); document.body.append(element);
    element.setAttribute('data-state', 'before'); const attribute = element.getAttributeNode('data-state');
    attribute.value = 'after'; expect(document.querySelector('[data-state="after"]')).toBe(element);
    expect(element.outerHTML).toBe('<div data-state="after"></div>');
    const clone = element.cloneNode(true); element.removeAttributeNode(attribute);
    expect(element.matches('[data-state]')).toBe(false); expect(clone.getAttribute('data-state')).toBe('after');
  });

  test('should reflect dataset names and real attribute changes through the runner globals', () => {
    const element = document.createElement('div'); document.body.append(element);
    element.dataset.userId = '123'; element.setAttribute('data-next-value', 'next');
    expect(element.getAttribute('data-user-id')).toBe('123');
    expect(Object.entries(element.dataset)).toEqual([['userId', '123'], ['nextValue', 'next']]);
    delete element.dataset.userId; expect(element.hasAttribute('data-user-id')).toBe(false);
  });

  test('should synchronize classList and preserve replacement order through real attribute hooks', () => {
    const element = document.createElement('div'); document.body.append(element);
    element.className = ' a b a '; const list = element.classList;
    expect([...list]).toEqual(['a', 'b']); expect(list.replace('b', 'a')).toBe(true);
    expect(element.className).toBe('a');
    element.setAttribute('class', ' external external next ');
    expect(list.contains('external')).toBe(true); expect(list.toggle('next', false)).toBe(false);
    expect(list.value).toBe('external');
  });

  test('should preserve XML namespaces and escaping through the runner browser globals', () => {
    const xml = new DOMParser().parseFromString('<root xmlns="urn:r"><child a="&amp;"/></root>', 'text/xml');
    expect(new XMLSerializer().serializeToString(xml)).toBe('<root xmlns="urn:r"><child a="&amp;"/></root>');
    xml.documentElement.innerHTML = '<p:item xmlns:p="urn:p">&lt;</p:item>';
    expect(xml.documentElement.outerHTML).toBe('<root xmlns="urn:r"><p:item xmlns:p="urn:p">&lt;</p:item></root>');
    expect(xml.documentElement.innerHTML).toBe('<p:item xmlns:p="urn:p">&lt;</p:item>');
  });

  test('should preserve rectangle numerical edges and independent JSON through browser globals', () => {
    const rect = new DOMRect(2, 3, -4, -5); const readOnly = DOMRectReadOnly.fromRect(rect);
    expect(rect.left).toBe(-2); expect(rect.top).toBe(-2); rect.width = 10;
    expect(rect.right).toBe(12); expect(readOnly.right).toBe(2);
    const json = rect.toJSON(); json.x = 99; expect(rect.x).toBe(2);
    expect(Object.is(new DOMRect(-0, -0, 0, 0).left, -0)).toBe(true);
    expect(Number.isNaN(new DOMRect(Infinity, 0, -Infinity, 1).right)).toBe(true);
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
