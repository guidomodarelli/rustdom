/** @file Runs the browser contract inside Vitest's actual environment lifecycle. */
import { test, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

/** Share the actual CommonJS React integration without transforming it into ESM. */
const registerDomSuite = createRequire(import.meta.url)('./dom-suite.cjs');

registerDomSuite({ test, expect, afterEach });

test('should advance window timers when Vitest uses fake timers', () => {
  vi.useFakeTimers();
  const callback = vi.fn();
  window.setTimeout(callback, 100);
  vi.advanceTimersByTime(100);
  expect(callback).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
