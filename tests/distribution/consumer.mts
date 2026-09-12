/** Exercises named/default ESM exports, native contracts and the installed Vitest VM adapter. */
import assert from 'node:assert/strict';
import runtime, { JSDOM, CookieJar, getNativeTreeStatistics } from '@rustdom/rustdom';
import nativeRuntime, {
  NativeTree, NativeRange, QueryMode, DocumentTypeField, RangePointRelation, RangeBoundaryMode,
  RangeBoundaryAction, RangeComparison, RangeDeletionKind, RangeSurroundStatus,
} from '@rustdom/rustdom/native';
import environment from '@rustdom/rustdom/vitest';

assert.equal(runtime.JSDOM, JSDOM);
const dom = new JSDOM('<!doctype html><p>Hello</p>', { cookieJar: new CookieJar() });
dom.window.document.body.insertAdjacentHTML('beforeend', '<span>Installed</span>');
assert.equal(dom.window.document.querySelector('span')?.textContent, 'Installed');
assert.ok(getNativeTreeStatistics().dataNodes > 0);
const nativeTree = new NativeTree();
const doctype = nativeTree.allocate();
nativeTree.initializeDocumentType(doctype, 'html', 'public', 'system');
assert.equal(nativeTree.documentTypeField(doctype, DocumentTypeField.SystemId), 'system');
nativeTree.release(doctype);
assert.equal(nativeTree.statistics().liveNodes, 0);
assert.equal(QueryMode.First, 1);

// Named ESM bindings must operate on the same addon classes and status objects as the default export.
assert.equal(nativeRuntime.NativeRange, NativeRange);
const containerHandle = nativeTree.allocate();
nativeTree.setHtmlElement(containerHandle, 'section', []);
const textHandle = nativeTree.allocate();
nativeTree.setCharacterData(textHandle, 3, 'installed Range');
nativeTree.append(containerHandle, textHandle);
const rangeState = new NativeRange();
rangeState.setStart(textHandle, 0);
rangeState.setEnd(textHandle, 9);
assert.equal(nativeTree.rangeTextFromState(rangeState), 'installed');
assert.equal(nativeTree.rangePointRelationFromState(rangeState, textHandle, 4), RangePointRelation.Inside);
assert.equal(nativeTree.rangePointRelationFromState(rangeState, textHandle, 99), RangePointRelation.InvalidOffset);
const boundaryPlan = nativeTree.rangeBoundaryPlanFromState(rangeState, RangeBoundaryMode.SelectNode, textHandle, 0);
assert.deepEqual(boundaryPlan, {
  action: RangeBoundaryAction.BothStartFirst, node: containerHandle, startOffset: 0, endOffset: 1,
});
const copiedRangeState = rangeState.copy();
copiedRangeState.setStart(textHandle, 1);
assert.equal(nativeTree.compareRangeStates(rangeState, 0, copiedRangeState), RangeComparison.Before);
assert.equal(rangeState.startOffset, 0);
assert.deepEqual(copiedRangeState.collapsePlan(false), { node: textHandle, offset: 9, updateStart: true });
const deletionPlan = nativeTree.rangeDeletionPlan(rangeState);
assert.equal(deletionPlan.kind, RangeDeletionKind.CharacterData);
assert.equal(deletionPlan.startCount, 9);
assert.equal(nativeTree.rangeSurroundStatus(rangeState, containerHandle), RangeSurroundStatus.Ready);
const fragmentHandle = nativeTree.allocate();
nativeTree.setSimpleData(fragmentHandle, 11, '');
assert.equal(nativeTree.rangeSurroundStatus(rangeState, fragmentHandle), RangeSurroundStatus.InvalidParentType);
assert.equal(nativeTree.getCharacterData(textHandle), 'installed Range');
for (const nodeHandle of [textHandle, containerHandle, fragmentHandle]) nativeTree.release(nodeHandle);
assert.equal(nativeTree.statistics().liveNodes, 0);
// Numeric endpoint state survives handle release without owning the corresponding native nodes.
assert.equal(rangeState.endOffset, 9);
dom.window.close();
assert.ok(environment.setupVM);
const session = await environment.setupVM({ jsdom: { html: '<p>VM package</p>' } });
const context = session.getVmContext();
assert.equal(context.document.querySelector('p').textContent, 'VM package');
assert.equal(context.document.querySelector('p').firstChild.nodeValue, 'VM package');
const paragraph = context.document.querySelector('p');
paragraph.append(context.document.createTextNode(' appended'));
paragraph.normalize();
assert.equal(paragraph.childNodes.length, 1);
assert.equal(paragraph.textContent, 'VM package appended');
const selectedRange = context.document.createRange();
selectedRange.selectNodeContents(paragraph);
assert.equal(selectedRange.comparePoint(paragraph.firstChild, 1), 0);
assert.equal(selectedRange.intersectsNode(paragraph.firstChild), true);
assert.equal(selectedRange.isPointInRange(paragraph.firstChild, 1), true);
assert.equal(selectedRange.toString(), 'VM package appended');
selectedRange.setStart(paragraph.firstChild, 3);
selectedRange.setEnd(paragraph.firstChild, 10);
assert.equal(selectedRange.toString(), 'package');
assert.equal(selectedRange.commonAncestorContainer, paragraph.firstChild);
selectedRange.selectNode(paragraph);
assert.equal(selectedRange.commonAncestorContainer, context.document.body);
const liveState = context.document.createRange();
liveState.setStart(paragraph.firstChild, 1); liveState.setEnd(paragraph.firstChild, 3);
const frozenState = new context.StaticRange({ startContainer: paragraph.firstChild, startOffset: 1,
  endContainer: paragraph.firstChild, endOffset: 3 });
const copiedState = liveState.cloneRange();
paragraph.firstChild.insertData(0, '!');
assert.equal(liveState.startOffset, 2); assert.equal(copiedState.startOffset, 2); assert.equal(frozenState.startOffset, 1);
copiedState.collapse(false);
assert.equal(copiedState.collapsed, true);
assert.equal(liveState.collapsed, false);
assert.equal(copiedState.compareBoundaryPoints(context.Range.START_TO_START, liveState), 1);
liveState.deleteContents();
assert.equal(liveState.collapsed, true); assert.equal(liveState.startOffset, 2);
assert.equal(copiedState.startOffset, 2); assert.equal(frozenState.startOffset, 1);
const contentRoot = context.document.createElement('div'); contentRoot.innerHTML = '<b>left</b><i>right</i>';
context.document.body.append(contentRoot);
const contentRange = context.document.createRange(); contentRange.setStart(contentRoot.firstChild.firstChild, 1);
contentRange.setEnd(contentRoot.lastChild.firstChild, 2);
assert.equal(contentRange.cloneContents().textContent, 'eftri');
assert.equal(contentRange.extractContents().textContent, 'eftri');
assert.equal(contentRange.collapsed, true); assert.equal(contentRoot.textContent, 'lght');
const surrounding = context.document.createElement('section');
contentRange.selectNodeContents(contentRoot); contentRange.surroundContents(surrounding);
assert.equal(contentRoot.firstChild, surrounding); assert.equal(surrounding.textContent, 'lght');
selectedRange.setStartBefore(paragraph);
selectedRange.setEndAfter(paragraph);
assert.throws(() => selectedRange.comparePoint(paragraph.firstChild, 999), { name: 'IndexSizeError' });
assert.ok(context.document.body.contains(context.document.querySelector('p')));
assert.ok(context.document.body.isEqualNode(context.document.body.cloneNode(true)));
context.document.body.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:p', 'urn:vm');
assert.equal(context.document.querySelector('p').lookupNamespaceURI('p'), 'urn:vm');
await session.teardown();
