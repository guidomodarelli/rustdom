/** Exercises named/default ESM exports, native contracts and the installed Vitest VM adapter. */
import assert from 'node:assert/strict';
import runtime, { JSDOM, CookieJar, getNativeTreeStatistics } from '@rustdom/rustdom';
import { NativeTree, QueryMode } from '@rustdom/rustdom/native';
import environment from '@rustdom/rustdom/vitest';

assert.equal(runtime.JSDOM, JSDOM);
const dom = new JSDOM('<!doctype html><p>Hello</p>', { cookieJar: new CookieJar() });
dom.window.document.body.insertAdjacentHTML('beforeend', '<span>Installed</span>');
assert.equal(dom.window.document.querySelector('span')?.textContent, 'Installed');
assert.ok(getNativeTreeStatistics().dataNodes > 0);
assert.equal(new NativeTree().statistics().liveNodes, 0);
assert.equal(QueryMode.First, 1);
dom.window.close();
assert.ok(environment.setupVM);
const session = await environment.setupVM({ jsdom: { html: '<p>VM package</p>' } });
const context = session.getVmContext();
assert.equal(context.document.querySelector('p').textContent, 'VM package');
await session.teardown();
