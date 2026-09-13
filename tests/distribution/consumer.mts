/** Exercises named/default ESM exports, native contracts and the installed Vitest VM adapter. */
import assert from 'node:assert/strict';
import runtime, { JSDOM, CookieJar, getNativeTreeStatistics } from '@rustdom/rustdom';
import nativeRuntime, {
  NativeTree, NativeRange, QueryMode, DocumentTypeField, RangePointRelation, RangeBoundaryMode,
  RangeBoundaryAction, RangeComparison, RangeDeletionKind, RangeSurroundStatus,
  RangeMutationKind, RangeEndpoint,
  NativeRangeClone, RangeCloneAction,
  NativeRangeExtract, RangeExtractAction, NodeTextWriteAction, NodeInsertionStatus,
  NativeSlotAssignmentDriver, SlotAssignmentAction,
  NativeMutationRecord, ObservationStatus,
  NativeObserverDelivery, ObserverDeliveryAction,
  NativeEventState, EventStateFlag, EventDispatchStatus, EventInvocationEncoding,
  NativeListenerRegistry, ListenerInvocation,
  NativeAbortState,
  NativeXmlParser,
  NativeTraversal, TraversalMethod, TraversalAction, TraversalMoveResult,
} from '@rustdom/rustdom/native';
import environment from '@rustdom/rustdom/vitest';

/** Installed ESM traversal names drive actual native movement, preserving literal action types. */
const traversalTree = new NativeTree(); const traversalRoot = traversalTree.allocate();
traversalTree.setData(traversalRoot, JSON.stringify({ kind: 1, name: 'root' }));
const traversal = traversalTree.createTraversal(traversalRoot, 1, false);
const traversalMethod: TraversalMethod = TraversalMethod.IteratorNext;
const traversalStep = traversalTree.traversalStep(traversal, traversal.start(traversalMethod));
const traversalAction: TraversalAction = traversalStep.kind;
assert.equal(traversalAction, TraversalAction.Accepted); assert.equal(traversalStep.node, traversalRoot);
assert.equal(NativeTraversal, nativeRuntime.NativeTraversal);
assert.equal(traversalTree.traversalMove(traversal, TraversalMethod.IteratorPrevious), traversalRoot);
const completedTraversal: TraversalMoveResult = TraversalMoveResult.Complete;
assert.equal(traversalTree.traversalMove(traversal, TraversalMethod.IteratorPrevious), completedTraversal);
assert.equal(TraversalMoveResult, nativeRuntime.TraversalMoveResult);
traversalTree.release(traversalRoot);

/** Forward-only native actions retain their literal value union in installed consumers. */
const slotAssignmentActions: readonly SlotAssignmentAction[] = [
  SlotAssignmentAction.Complete, SlotAssignmentAction.Signal, SlotAssignmentAction.Applied,
];
assert.deepEqual(slotAssignmentActions, [0, 1, 2]);
assert.deepEqual(Object.getOwnPropertyNames(SlotAssignmentAction).sort(), ['Applied', 'Complete', 'Signal']);
for (const action of slotAssignmentActions) {
  // @ts-expect-error The native object has no reverse numeric mapping.
  assert.equal(SlotAssignmentAction[action], undefined);
  assert.equal(Object.hasOwn(SlotAssignmentAction, action), false);
}

assert.equal(runtime.JSDOM, JSDOM);
const dom = new JSDOM('<!doctype html><p>Hello</p>', { cookieJar: new CookieJar() });
dom.window.document.body.insertAdjacentHTML('beforeend', '<span>Installed</span>');
assert.equal(dom.window.document.querySelector('span')?.textContent, 'Installed');
assert.ok(getNativeTreeStatistics().dataNodes > 0);
const nativeTree = new NativeTree();
assert.equal(NativeMutationRecord, nativeRuntime.NativeMutationRecord);
assert.equal(ObservationStatus, nativeRuntime.ObservationStatus);
assert.equal(NativeObserverDelivery, nativeRuntime.NativeObserverDelivery);
assert.equal(ObserverDeliveryAction, nativeRuntime.ObserverDeliveryAction);
assert.equal(NativeEventState, nativeRuntime.NativeEventState); assert.equal(EventStateFlag, nativeRuntime.EventStateFlag);
assert.equal(EventDispatchStatus, nativeRuntime.EventDispatchStatus);
assert.equal(EventInvocationEncoding, nativeRuntime.EventInvocationEncoding);
assert.equal(NativeListenerRegistry, nativeRuntime.NativeListenerRegistry); assert.equal(ListenerInvocation, nativeRuntime.ListenerInvocation);
assert.equal(NativeAbortState, nativeRuntime.NativeAbortState);
assert.equal(NativeXmlParser, nativeRuntime.NativeXmlParser);
const assignmentRoot = nativeTree.allocate(); nativeTree.setData(assignmentRoot, '{"kind":11}');
const assignmentOperation = new NativeSlotAssignmentDriver(assignmentRoot, true);
assert.equal(NativeSlotAssignmentDriver, nativeRuntime.NativeSlotAssignmentDriver);
assert.equal(SlotAssignmentAction, nativeRuntime.SlotAssignmentAction);
assert.equal(nativeTree.slotAssignmentStep(assignmentOperation).kind, SlotAssignmentAction.Complete);
assert.equal(assignmentOperation.complete, true); assignmentOperation.cancel(); nativeTree.release(assignmentRoot);
const doctype = nativeTree.allocate();
nativeTree.initializeDocumentType(doctype, 'html', 'public', 'system');
assert.equal(NodeTextWriteAction, nativeRuntime.NodeTextWriteAction);
assert.equal(nativeTree.textWriteAction(doctype, true), NodeTextWriteAction.Ignore);
assert.equal(nativeTree.documentTypeField(doctype, DocumentTypeField.SystemId), 'system');
const insertionDocument = nativeTree.allocate(); nativeTree.setData(insertionDocument, '{"kind":9}');
assert.equal(NodeInsertionStatus, nativeRuntime.NodeInsertionStatus);
assert.equal(nativeTree.preInsertConstraints(insertionDocument, doctype, 0), NodeInsertionStatus.Ready);
nativeTree.append(insertionDocument, doctype);
assert.equal(nativeTree.preInsertConstraints(insertionDocument, doctype, 0), NodeInsertionStatus.InvalidDocumentStructure);
assert.equal(nativeTree.preReplaceConstraints(insertionDocument, doctype, doctype), NodeInsertionStatus.Ready);
nativeTree.release(insertionDocument);
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
const cloneOperation = new NativeRangeClone(rangeState);
const cloneInstruction = nativeTree.rangeCloneStep(cloneOperation, 0);
assert.equal(cloneInstruction.kind, RangeCloneAction.CreateFragment); assert.equal(cloneInstruction.node, textHandle);
cloneOperation.cancel(); assert.throws(() => nativeTree.rangeCloneStep(cloneOperation, 0), { code: 'InvalidArg' });
const extractOperation = new NativeRangeExtract(rangeState);
assert.equal(nativeTree.rangeExtractStep(extractOperation, 0).kind, RangeExtractAction.CreateFragment);
extractOperation.cancel(); assert.throws(() => nativeTree.rangeExtractStep(extractOperation, 0), { code: 'InvalidArg' });
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
assert.deepEqual(rangeState.splitTextPlan(textHandle, containerHandle, 4), [{ start: false, node: containerHandle, offset: 5 }]);
assert.equal(rangeState.endOffset, 9);
const mutableRange = rangeState.copy();
assert.equal(mutableRange.applyTreeMutation(RangeMutationKind.SplitText, textHandle, containerHandle, 4, 0), RangeEndpoint.End);
assert.deepEqual(mutableRange.end, { node: containerHandle, offset: 5 }); assert.equal(rangeState.endOffset, 9);
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
const eventStatesBefore = getNativeTreeStatistics().eventStates.created;
const installedEvent = new context.Event('installed-event', { bubbles: true, cancelable: true, composed: true });
context.document.body.addEventListener('installed-event', (event: Event) => { event.preventDefault(); assert.equal(event.eventPhase, 2); }, { once: true });
assert.equal(context.document.body.dispatchEvent(installedEvent), false); assert.equal(installedEvent.defaultPrevented, true);
installedEvent.initEvent('reset-event', false, false); assert.equal(installedEvent.defaultPrevented, false); assert.equal(installedEvent.composed, true);
assert.ok(getNativeTreeStatistics().eventStates.created > eventStatesBefore);
const recordTarget = context.document.createElement('section'); context.document.body.append(recordTarget);
const nativeRecordsBefore = getNativeTreeStatistics().mutationRecords.created;
const nativeRegistrationsBefore = getNativeTreeStatistics().mutationObservers.registrations;
const nativeQueuedBefore = getNativeTreeStatistics().mutationObservers.queuedRecords;
const nativePendingBefore = getNativeTreeStatistics().mutationNotifications.pendingObservers;
const recordObserver = new context.MutationObserver(() => {});
recordObserver.observe(recordTarget, { childList: true, attributes: true, attributeOldValue: true });
assert.equal(getNativeTreeStatistics().mutationObservers.registrations, nativeRegistrationsBefore + 1);
const recordChild = context.document.createElement('b'); recordTarget.append(recordChild);
recordTarget.setAttribute('data-record', 'one'); recordTarget.setAttribute('data-record', 'two');
assert.equal(getNativeTreeStatistics().mutationObservers.queuedRecords, nativeQueuedBefore + 3);
assert.equal(getNativeTreeStatistics().mutationNotifications.pendingObservers, nativePendingBefore + 1);
assert.equal(getNativeTreeStatistics().mutationNotifications.microtaskQueued, true);
const installedRecords = recordObserver.takeRecords(); recordObserver.disconnect();
assert.equal(getNativeTreeStatistics().mutationObservers.queuedRecords, nativeQueuedBefore);
assert.equal(getNativeTreeStatistics().mutationNotifications.pendingObservers, nativePendingBefore + 1);
assert.equal(getNativeTreeStatistics().mutationObservers.registrations, nativeRegistrationsBefore);
assert.equal(installedRecords.length, 3); assert.equal(installedRecords[0].target, recordTarget);
assert.equal(installedRecords[0].addedNodes[0], recordChild);
assert.equal(installedRecords[0].addedNodes, installedRecords[0].addedNodes);
assert.ok(installedRecords[0] instanceof context.MutationRecord);
assert.ok(installedRecords[0].addedNodes instanceof context.NodeList);
assert.equal(installedRecords[2].oldValue, 'one'); assert.equal(installedRecords[2].attributeName, 'data-record');
assert.ok(getNativeTreeStatistics().mutationRecords.created >= nativeRecordsBefore + 3);
const deliveriesBefore = getNativeTreeStatistics().observerDeliveries.created;
const deliveredAttributes: string[] = [];
const deliveryObserver = new context.MutationObserver((records: MutationRecord[]) => {
  deliveredAttributes.push(...records.map((record) => record.attributeName ?? ''));
});
deliveryObserver.observe(recordTarget, { attributes: true }); recordTarget.setAttribute('data-delivery', 'ready');
await new Promise((resolve) => setImmediate(resolve)); deliveryObserver.disconnect();
assert.deepEqual(deliveredAttributes, ['data-delivery']);
assert.ok(getNativeTreeStatistics().observerDeliveries.created > deliveriesBefore);
const fullProducerObserver = new context.MutationObserver(() => {}); const leanProducerObserver = new context.MutationObserver(() => {});
fullProducerObserver.observe(recordTarget, { attributeOldValue: true }); leanProducerObserver.observe(recordTarget, { attributes: true });
recordTarget.setAttribute('data-producer', 'old'); recordTarget.setAttribute('data-producer', 'new');
const fullProduced = fullProducerObserver.takeRecords(); const leanProduced = leanProducerObserver.takeRecords();
assert.deepEqual(fullProduced.map((record: MutationRecord) => record.oldValue), [null, 'old']);
assert.deepEqual(leanProduced.map((record: MutationRecord) => record.oldValue), [null, null]);
assert.notEqual(fullProduced[0], leanProduced[0]); assert.equal(fullProduced[1].target, recordTarget);
fullProducerObserver.disconnect(); leanProducerObserver.disconnect();
assert.equal(context.document.querySelector('p').textContent, 'VM package');
assert.equal(context.document.querySelector('p').firstChild.nodeValue, 'VM package');
const paragraph = context.document.querySelector('p');
assert.equal(paragraph.getRootNode(), context.document); assert.equal(paragraph.isConnected, true);
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
const inserted = context.document.createDocumentFragment(); inserted.append(context.document.createElement('i'), 'installed');
contentRange.collapse(false); contentRange.insertNode(inserted);
assert.equal(inserted.childNodes.length, 0); assert.equal(contentRoot.textContent, 'lghtinstalled');
assert.equal(contentRange.startOffset, 1); assert.equal(contentRange.endOffset, 3);
const contextual = contentRange.createContextualFragment('<em>context</em>');
assert.equal(contextual.firstChild?.localName, 'em'); assert.equal(contextual.textContent, 'context');
assert.equal(contextual.ownerDocument, context.document);
selectedRange.setStartBefore(paragraph);
selectedRange.setEndAfter(paragraph);
assert.throws(() => selectedRange.comparePoint(paragraph.firstChild, 999), { name: 'IndexSizeError' });
assert.ok(context.document.body.contains(context.document.querySelector('p')));
assert.ok(context.document.body.isEqualNode(context.document.body.cloneNode(true)));
context.document.body.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:p', 'urn:vm');
assert.equal(context.document.querySelector('p').lookupNamespaceURI('p'), 'urn:vm');
const host = context.document.createElement('section'); context.document.body.append(host);
const shadow = host.attachShadow({ mode: 'closed' }); shadow.innerHTML = '<b>hosted</b>';
assert.equal(shadow.firstChild.getRootNode(), shadow);
assert.equal(shadow.firstChild.getRootNode({ composed: true }), context.document);
assert.equal(shadow.firstChild.isConnected, true);
assert.ok(getNativeTreeStatistics().rootHosts.hostedRoots > 0);
let observedTarget: EventTarget | null = null;
host.addEventListener('retarget-check', (event: Event) => { observedTarget = event.target; });
shadow.firstChild.dispatchEvent(new context.Event('retarget-check', { bubbles: true, composed: true }));
assert.equal(observedTarget, host);
const slotHost = context.document.createElement('section'); host.append(slotHost);
const slotRoot = slotHost.attachShadow({ mode: 'open' }); slotRoot.innerHTML = '<slot name="selected"></slot>';
const slotTarget = context.document.createElement('i'); slotTarget.slot = 'selected'; slotHost.append(slotTarget);
assert.equal(slotTarget.assignedSlot, slotRoot.firstChild);
const cachedAssignment = slotRoot.firstChild.assignedNodes();
assert.equal(cachedAssignment.length, 1); assert.equal(cachedAssignment[0], slotTarget);
assert.ok(getNativeTreeStatistics().slotAssignments.entries > 0);
assert.ok(getNativeTreeStatistics().slotableNames.namedNodes > 0);
slotTarget.slot = 'missing'; assert.equal(slotTarget.assignedSlot, null);
assert.equal(slotRoot.firstChild.assignedNodes().length, 0);
assert.equal(cachedAssignment[0], slotTarget);
let observedRecordedSlot = false;
slotTarget.addEventListener('recorded-slot-check', (event: Event) => {
  observedRecordedSlot = event.composedPath().includes(slotRoot.firstChild);
});
slotTarget.dispatchEvent(new context.Event('recorded-slot-check', { bubbles: true, composed: true }));
assert.equal(observedRecordedSlot, true); assert.ok(getNativeTreeStatistics().slotBacklinks.assignedNodes > 0);
assert.ok(getNativeTreeStatistics().slotSignals.pendingSlots > 0);
await new Promise<void>((resolve) => setImmediate(resolve));
assert.equal(getNativeTreeStatistics().slotSignals.pendingSlots, 0);
const slotXml = context.document.implementation.createDocument(null, 'root');
const slotCdata = slotXml.createCDATASection('cdata'); slotHost.append(slotCdata); slotRoot.firstChild.name = '';
assert.equal(slotCdata.assignedSlot, slotRoot.firstChild);
assert.ok(slotRoot.firstChild.assignedNodes({ flatten: true }).includes(slotCdata));
assert.equal(slotRoot.firstChild.assignedNodes({ flatten: true }).length, 1);
const relayHost = shadow.appendChild(context.document.createElement('section'));
const relayRoot = relayHost.attachShadow({ mode: 'open' });
const terminalSlot = relayRoot.appendChild(context.document.createElement('slot'));
const relaySlot = relayHost.appendChild(context.document.createElement('slot')); relaySlot.name = 'outer';
const outerLeaf = context.document.createElement('b'); outerLeaf.slot = 'outer'; host.append(outerLeaf);
assert.equal(terminalSlot.assignedNodes()[0], relaySlot);
assert.equal(terminalSlot.assignedNodes({ flatten: true }).length, 1);
assert.equal(terminalSlot.assignedNodes({ flatten: true })[0], outerLeaf);
host.remove(); assert.equal(shadow.firstChild.getRootNode({ composed: true }), host);
await session.teardown();
