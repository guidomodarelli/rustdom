/** @module integration/collection-suite Exercises real live collections in Jest, Vitest and Vitest VM globals. */
'use strict';

/** @param {object} runner - Actual test and assertion functions. @returns {void} Registers a public browser integration. */
module.exports = function registerCollectionSuite({ test, expect }) {
  test('should preserve live native collection membership, namespaces and identities through runner globals', () => {
    const root = document.createElement('main'); root.className = 'match'; document.body.append(root);
    try {
      root.innerHTML = '<div id="first" class="match"></div><div id="second"></div>';
      const first = root.firstElementChild; const second = root.lastElementChild;
      const namespaced = document.createElementNS('urn:runner-collection', 'p:entry');
      namespaced.setAttribute('class', 'match'); root.append(namespaced);
      const classes = root.getElementsByClassName('match');
      const tags = root.getElementsByTagName('DIV');
      const namespaces = root.getElementsByTagNameNS('urn:runner-collection', 'entry');
      expect(classes).toBeInstanceOf(window.HTMLCollection);
      expect(Array.from(classes)).toEqual([first, namespaced]); expect(Array.from(tags)).toEqual([first, second]);
      expect(Array.from(namespaces)).toEqual([namespaced]);
      second.className = 'match'; root.prepend(namespaced); first.remove();
      root.attachShadow({ mode: 'open' }).innerHTML = '<div class="match">shadow</div>';
      expect(Array.from(classes)).toEqual([namespaced, second]); expect(Array.from(tags)).toEqual([second]);
      expect(classes.namedItem('second')).toBe(second); expect(classes.item(0)).toBe(namespaced);
      expect(Array.from(namespaces)).toEqual([namespaced]); expect(Array.from(classes)).not.toContain(root);
    } finally { root.remove(); }
  });
};
