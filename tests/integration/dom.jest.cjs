/** @file Runs the browser contract with Jest's real custom environment and fake timers. */
require('./dom-suite.cjs')({ test, expect, afterEach });

test('should advance window timers when Jest uses fake timers', () => {
  jest.useFakeTimers();
  const callback = jest.fn();
  window.setTimeout(callback, 100);
  jest.advanceTimersByTime(100);
  expect(callback).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});
