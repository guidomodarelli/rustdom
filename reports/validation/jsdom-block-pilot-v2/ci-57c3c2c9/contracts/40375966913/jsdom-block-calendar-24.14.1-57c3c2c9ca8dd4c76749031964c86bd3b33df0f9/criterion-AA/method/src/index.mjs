/** @module rustdom Exposes explicit ESM names backed by the same CommonJS runtime instance. */
import runtime from './index.cjs';
export const { JSDOM, VirtualConsole, CookieJar, ResourceLoader, toughCookie,
  getParserStatistics, getNativeTreeStatistics } = runtime;
export default runtime;
