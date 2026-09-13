/** Exercises the installed CommonJS contract with TypeScript and the real native addon. */
import assert = require('node:assert/strict');
import rustdom = require('@rustdom/rustdom');
import native = require('@rustdom/rustdom/native');
import JestEnvironment = require('@rustdom/rustdom/jest');

/** Native abort composition preserves source order and marks dependents before delivery. */
const abortSource = new native.NativeAbortState(); const abortDependent = new native.NativeAbortState();
assert.deepEqual(abortDependent.initializeAny([abortSource.id, abortSource.id]), { reasonSource: 0, sources: [abortSource.id], sourceInputs: [0] });
abortSource.aborted = true; assert.deepEqual(abortSource.markDependents(), [abortDependent.id]); assert.equal(abortDependent.aborted, true);

/** Installed native listener metadata preserves duplicate options and one-shot removal. */
const listenerRegistry = new native.NativeListenerRegistry();
const listenerId = listenerRegistry.add('installed\ud800', 1, false, true, true);
assert.equal(listenerRegistry.add('installed\ud800', 1, false, false, false), 0);
assert.deepEqual(listenerRegistry.snapshot('installed\ud800'), [listenerId]);
assert.deepEqual(listenerRegistry.snapshotSelection('installed\ud800', true), { ids: [listenerId], selected: [] });
assert.equal(listenerRegistry.prepareInvocation(listenerId, false), native.ListenerInvocation.Invoke | native.ListenerInvocation.Once | native.ListenerInvocation.Passive | native.ListenerInvocation.ForgetCallback);
assert.deepEqual(listenerRegistry.snapshot('installed\ud800'), []); assert.equal(listenerRegistry.hasEventTypes, true);

const scalarEvent = new native.NativeEventState('installed\ud800\0', true, true, true);
scalarEvent.setReturnValue('false'); assert.equal(scalarEvent.returnValue, true);
scalarEvent.finishConstruction(true, 123.5); scalarEvent.preventDefault();
assert.equal(scalarEvent.eventType, 'installed\ud800\0'); assert.equal(scalarEvent.returnValue, false);
assert.equal(scalarEvent.flag(native.EventStateFlag.Trusted), true);
scalarEvent.setFlag(native.EventStateFlag.Dispatching, true);
assert.equal(scalarEvent.initializeIfIdle('ignored', false, false), false);
scalarEvent.setFlag(native.EventStateFlag.Dispatching, false);
assert.equal(scalarEvent.initializeIfIdle('reset', false, false), true);
assert.equal(scalarEvent.timeStamp, 123.5); assert.equal(scalarEvent.flag(native.EventStateFlag.Composed), true);
assert.equal(scalarEvent.flag(native.EventStateFlag.Canceled), false);
assert.equal(scalarEvent.prepareDispatch(), native.EventDispatchStatus.Ready); scalarEvent.beginDispatch();
scalarEvent.appendPath(false, false, true); scalarEvent.appendPath(false, false, false);
assert.deepEqual(scalarEvent.nextInvocation(), { index: 1, targetIndex: 0, capturing: true, invoke: true });
assert.deepEqual(scalarEvent.visiblePathIndices(), [0, -1]); assert.equal(scalarEvent.eventPhase, 1);
assert.equal(scalarEvent.advanceInvocation(), native.EventInvocationEncoding.Capturing + native.EventInvocationEncoding.Invoke);
scalarEvent.finishDispatch(); assert.equal(scalarEvent.pathLength, 0); assert.equal(scalarEvent.pathCapacity, 0);

/** Forward-only native actions retain their literal value union in installed consumers. */
const slotAssignmentActions: readonly native.SlotAssignmentAction[] = [
  native.SlotAssignmentAction.Complete, native.SlotAssignmentAction.Signal, native.SlotAssignmentAction.Applied,
];
assert.deepEqual(slotAssignmentActions, [0, 1, 2]);
assert.deepEqual(Object.getOwnPropertyNames(native.SlotAssignmentAction).sort(), ['Applied', 'Complete', 'Signal']);
for (const action of slotAssignmentActions) {
  // @ts-expect-error The native object has no reverse numeric mapping.
  assert.equal(native.SlotAssignmentAction[action], undefined);
  assert.equal(Object.hasOwn(native.SlotAssignmentAction, action), false);
}

const dom = new rustdom.JSDOM('<!doctype html><p id="target">Before</p>');
/** BeforeUnloadEvent converts returnValue to DOMString before reaching the native state. */
const beforeUnload = dom.window.document.createEvent('BeforeUnloadEvent');
beforeUnload.initEvent('beforeunload', false, true);
beforeUnload.returnValue = 'leave'; assert.equal(beforeUnload.defaultPrevented, false);
beforeUnload.preventDefault(); assert.equal(beforeUnload.defaultPrevented, true);
const paragraph: Element | null = dom.window.document.querySelector('#target');
assert.ok(paragraph);
assert.equal(dom.window.getComputedStyle(paragraph).display, 'block');
paragraph.textContent = 'After 🦀';
assert.equal(paragraph.textContent, 'After 🦀');
assert.equal(paragraph.firstChild?.nodeValue, 'After 🦀');
assert.ok(dom.serialize().includes('After 🦀'));
assert.ok(rustdom.getParserStatistics().nativeDocument > 0);
assert.ok(rustdom.getNativeTreeStatistics().nativeQueries > 0);
for (const name of ['Ä', 'ä', '\ua7ce', '\ua7d2', '\ua7d4']) {
  paragraph.setAttributeNS(null, name, 'case');
  // Pinned jsdom exposes named lookup separately from own-key enumeration.
  assert.equal(Object.hasOwn(paragraph.attributes, name), true);
  assert.equal(Reflect.ownKeys(paragraph.attributes).includes(name), name.toLowerCase() === name);
}
assert.equal(typeof JestEnvironment.prototype.getVmContext, 'function');
assert.ok(paragraph.isEqualNode(paragraph.cloneNode(true)));
assert.ok(dom.window.document.body.contains(paragraph));
const instruction = dom.window.document.createProcessingInstruction('target', 'before');
instruction.data = 'after';
assert.equal(instruction.target, 'target');
assert.ok(instruction.isEqualNode(dom.window.document.createProcessingInstruction('target', 'after')));
const namespaced = dom.window.document.createElementNS('urn:installed', 'p:item');
paragraph.appendChild(namespaced);
assert.equal(namespaced.lookupNamespaceURI('p'), 'urn:installed');
assert.equal(namespaced.lookupPrefix('urn:installed'), 'p');
assert.equal(namespaced.isDefaultNamespace('urn:installed'), false);
dom.window.close();

const tree = new native.NativeTree();
const handle = tree.allocate();
tree.setHtmlElement(handle, 'b', ['title', 'installed']);
const nativeRecord = new native.NativeMutationRecord(tree, { kind: 'attributes', target: handle,
  previousSibling: 0, nextSibling: 0, attributeName: 'flag\ud800', attributeNamespace: null,
  oldValue: 'old\0\udc00', addedNodes: [], removedNodes: [] });
assert.equal(nativeRecord.kind, 'attributes'); assert.equal(nativeRecord.target, handle);
assert.equal(nativeRecord.attributeName, 'flag\ud800'); assert.equal(nativeRecord.attributeNamespace, null);
assert.equal(nativeRecord.oldValue, 'old\0\udc00'); assert.deepEqual(nativeRecord.addedNodes, []);
assert.ok(native.NativeMutationRecord.statistics().created > 0);
const nativeObserver = tree.allocateMutationObserver();
assert.equal(tree.observeMutations(nativeObserver, handle, { attributeOldValue: true }), native.ObservationStatus.Added);
const preparedRecords = tree.prepareMutationRecords({ kind: 'attributes', target: handle, previousSibling: 0, nextSibling: 0,
  attributeName: 'flag\ud800\0', attributeNamespace: null, oldValue: 'prepared\udc00\0', addedNodes: [], removedNodes: [] });
assert.equal(preparedRecords.length, 1); assert.equal(preparedRecords[0].observer, nativeObserver);
assert.equal(preparedRecords[0].record.attributeName, 'flag\ud800\0'); assert.equal(preparedRecords[0].record.oldValue, 'prepared\udc00\0');
assert.equal(tree.observerRegistryStatistics().queuedRecords, 0);
const sharedBatch = tree.prepareMutationRecordBatch({ kind: 'attributes', target: handle, previousSibling: 0, nextSibling: 0,
  attributeName: 'batch', attributeNamespace: null, oldValue: 'shared\0', addedNodes: [], removedNodes: [] });
assert.ok(sharedBatch); assert.deepEqual(sharedBatch.observers, [nativeObserver]); assert.deepEqual(sharedBatch.payloadIndices, [0]);
assert.equal(sharedBatch.payloads.length, 1); assert.equal(sharedBatch.payloads[0].oldValue, 'shared\0');
const queuedToken = tree.enqueueMutationRecord(nativeObserver, nativeRecord);
assert.equal(tree.observerNotificationStatistics().pendingObservers, 1);
assert.equal(tree.requestMutationObserverMicrotask(), true); assert.equal(tree.requestMutationObserverMicrotask(), false);
assert.equal(tree.observerRegistryStatistics().queuedRecords, 1);
assert.equal(tree.queuedMutationRecord(nativeObserver, queuedToken)?.oldValue, 'old\0\udc00');
assert.deepEqual(tree.takeMutationRecords(nativeObserver), [queuedToken]);
assert.equal(tree.queuedMutationRecord(nativeObserver, queuedToken), null);
assert.equal(tree.observerRegistryStatistics().queuedRecords, 0);
assert.deepEqual(tree.interestedMutationObservers(handle, 'attributes', 'title', null), [{ observer: nativeObserver, oldValue: true }]);
assert.equal(tree.observeMutations(nativeObserver, handle, {}), native.ObservationStatus.MissingMutationKind);
assert.deepEqual(tree.disconnectMutationObserver(nativeObserver), [handle]);
assert.equal(tree.observerNotificationStatistics().microtaskQueued, true);
assert.deepEqual(tree.beginMutationObserverNotification(), [nativeObserver]);
assert.deepEqual(tree.observerNotificationStatistics(), { pendingObservers: 0, capacity: 0, microtaskQueued: false });
const deliveryToken = tree.enqueueMutationRecord(nativeObserver, nativeRecord);
const delivery = tree.startMutationObserverDelivery();
assert.ok(delivery instanceof native.NativeObserverDelivery);
assert.deepEqual(tree.mutationObserverDeliveryStep(delivery), { kind: native.ObserverDeliveryAction.Observer,
  observer: nativeObserver, slot: 0, records: [deliveryToken], complete: true });
assert.equal(delivery.remainingObservers, 0); assert.equal(delivery.remainingSlots, 0);
assert.equal(tree.mutationObserverDeliveryStep(delivery).kind, native.ObserverDeliveryAction.Complete);
assert.equal(tree.releaseMutationObserver(nativeObserver), true);
assert.equal(tree.observerRegistryStatistics().observers, 0); assert.equal(tree.observerRegistryStatistics().registrations, 0);
assert.equal(tree.serializeHtml(handle, true, false), '<b title="installed"></b>');
const doctypeHandle = tree.allocate();
tree.initializeDocumentType(doctypeHandle, 'html', '\ud800', 'system');
assert.equal(tree.documentTypeField(doctypeHandle, native.DocumentTypeField.PublicId), '\ud800');
assert.equal(tree.compareDocumentPosition(handle, doctypeHandle), 37);
assert.equal(tree.equalNode(handle, doctypeHandle), false);
tree.release(doctypeHandle);
const namespaceHandle = tree.allocate();
tree.setData(namespaceHandle, JSON.stringify({ kind: 1, name: 'item', prefix: 'p', namespace: 'urn:native' }));
assert.equal(tree.lookupNamespaceUri(namespaceHandle, 'p'), 'urn:native');
assert.equal(tree.lookupPrefix(namespaceHandle, 'urn:native'), 'p');
assert.equal(tree.isDefaultNamespace(namespaceHandle, null), true);
const textHandle = tree.allocate();
tree.setCharacterData(textHandle, 3, 'native\ud800');
tree.append(namespaceHandle, textHandle);
assert.equal(tree.nodeValue(namespaceHandle), null);
assert.equal(tree.nodeValue(textHandle), 'native\ud800');
assert.equal(tree.textContent(namespaceHandle), 'native\ud800');
const siblingHandle = tree.allocate();
tree.setCharacterData(siblingHandle, 3, ' tail');
tree.append(namespaceHandle, siblingHandle);
assert.equal(tree.nodeRoot(textHandle), namespaceHandle);
assert.equal(tree.nodeLength(namespaceHandle), 2); assert.equal(tree.nodeLength(textHandle), 7);
assert.equal(tree.textWriteAction(textHandle, false), native.NodeTextWriteAction.CharacterData);
assert.equal(tree.textWriteAction(namespaceHandle, true), native.NodeTextWriteAction.ReplaceChildren);
assert.equal(tree.preInsertConstraints(namespaceHandle, textHandle, 0), native.NodeInsertionStatus.Ready);
assert.equal(tree.preReplaceConstraints(namespaceHandle, textHandle, textHandle), native.NodeInsertionStatus.Ready);
assert.equal(tree.isFollowing(siblingHandle, textHandle), true);
assert.deepEqual(tree.normalizationCandidates(namespaceHandle), [textHandle, siblingHandle]);
const group = tree.normalizationGroup(textHandle);
assert.ok(group);
assert.equal(group.parent, namespaceHandle);
assert.equal(group.originalLength, 'native\ud800'.length);
assert.equal(group.appendedData, ' tail');
assert.deepEqual(group.siblings, [siblingHandle]);
assert.equal(tree.nodeValue(textHandle), 'native\ud800');
assert.equal(tree.compareBoundaryPointsPosition(namespaceHandle, 0, textHandle, 0), -1);
assert.equal(tree.compareBoundaryPointsPosition(textHandle, 0, siblingHandle, 0), -1);
assert.equal(tree.rangePointRelation(textHandle, 0, namespaceHandle, 0, namespaceHandle, 2), native.RangePointRelation.Inside);
assert.equal(tree.rangePointRelation(textHandle, 999, namespaceHandle, 0, namespaceHandle, 2), native.RangePointRelation.InvalidOffset);
assert.equal(tree.rangeIntersectsNode(textHandle, namespaceHandle, 0, namespaceHandle, 2), true);
assert.equal(tree.rangeText(namespaceHandle, 0, namespaceHandle, 2), 'native\ud800 tail');
assert.equal(tree.rangeText(textHandle, 6, textHandle, 7), '\ud800');
assert.equal(tree.commonAncestor(textHandle, siblingHandle), namespaceHandle);
assert.deepEqual(tree.rangeBoundaryPlan(native.RangeBoundaryMode.SelectNode, siblingHandle, 0,
  namespaceHandle, 0, namespaceHandle, 2), {
  action: native.RangeBoundaryAction.BothStartFirst, node: namespaceHandle, startOffset: 1, endOffset: 2,
});
const rangeState = new native.NativeRange();
rangeState.setStart(textHandle, 0); rangeState.setEnd(textHandle, 7);
assert.equal(tree.rangeTextFromState(rangeState), 'native\ud800');
assert.equal(tree.commonAncestorFromState(rangeState), textHandle);
assert.equal(rangeState.collapsed, false);
const deletion = tree.rangeDeletionPlan(rangeState);
assert.equal(deletion.kind, native.RangeDeletionKind.CharacterData);
assert.equal(deletion.startCount, 7);
assert.equal(tree.getCharacterData(textHandle), 'native\ud800');
const contents = tree.rangeContentSelection(rangeState);
assert.ok(contents); assert.equal(contents.commonAncestor, textHandle); assert.deepEqual(contents.contained, []);
assert.equal(tree.rangeSurroundStatus(rangeState, namespaceHandle), native.RangeSurroundStatus.Ready);
assert.equal(tree.rangeFragmentContext(rangeState, true), namespaceHandle);
const cloneOperation = new native.NativeRangeClone(rangeState);
assert.equal(tree.rangeCloneStep(cloneOperation, 0).kind, native.RangeCloneAction.CreateFragment);
const cloneFragment = tree.allocate(); tree.setSimpleData(cloneFragment, 11, '');
assert.equal(tree.rangeCloneStep(cloneOperation, cloneFragment).kind, native.RangeCloneAction.CloneNode);
const clonedText = tree.allocate(); tree.setCharacterData(clonedText, 3, tree.getCharacterData(textHandle));
const sliceInstruction = tree.rangeCloneStep(cloneOperation, clonedText);
assert.equal(sliceInstruction.kind, native.RangeCloneAction.SliceData);
tree.setCharacterData(clonedText, 3, tree.substringData(clonedText, sliceInstruction.offset, sliceInstruction.count));
const appendInstruction = tree.rangeCloneStep(cloneOperation, 0); tree.append(appendInstruction.parent, appendInstruction.node);
assert.equal(tree.rangeCloneStep(cloneOperation, 0).kind, native.RangeCloneAction.Complete);
assert.equal(cloneOperation.complete, true); assert.equal(tree.textContent(cloneFragment), 'native\ud800');
cloneOperation.cancel(); tree.release(clonedText); tree.release(cloneFragment);
const extractOperation = new native.NativeRangeExtract(rangeState);
const extractInstruction = tree.rangeExtractStep(extractOperation, 0);
assert.equal(extractInstruction.kind, native.RangeExtractAction.CreateFragment);
assert.equal(extractInstruction.node, textHandle);
extractOperation.cancel(); assert.throws(() => tree.rangeExtractStep(extractOperation, 0), { code: 'InvalidArg' });
assert.deepEqual(tree.rangeInsertionPlan(rangeState, handle), { startNode: textHandle, startOffset: 0,
  parent: namespaceHandle, reference: textHandle, splitText: true });
assert.equal(tree.rangeInsertionOffset(handle, namespaceHandle, 0), 3);
assert.deepEqual(rangeState.characterDataPlan(textHandle, 1, 3, 2), [{ start: false, node: textHandle, offset: 6 }]);
assert.equal(rangeState.endOffset, 7);
/** Host links remain separate from ordinary topology and disappear with either endpoint. */
const hostTree = new native.NativeTree(); const hostedRoot = hostTree.allocate(); const rootHost = hostTree.allocate();
hostTree.setRootHost(hostedRoot, rootHost, true);
hostTree.setData(hostedRoot, '{"kind":11}'); hostTree.setHtmlElement(rootHost, 'div', []);
assert.equal(hostTree.shadowIncludingRoot(hostedRoot), rootHost);
assert.equal(hostTree.isHostInclusiveAncestor(rootHost, hostedRoot), true);
assert.equal(hostTree.isShadowInclusiveAncestor(rootHost, hostedRoot), true);
assert.equal(hostTree.retarget(hostedRoot, 0), rootHost);
const nativeSlot = hostTree.allocate(); hostTree.setHtmlElement(nativeSlot, 'slot', []); hostTree.append(hostedRoot, nativeSlot);
assert.equal(hostTree.findSlot(hostedRoot, ''), nativeSlot); assert.equal(hostTree.findSlot(hostedRoot, 'missing'), 0);
hostTree.setHtmlElement(nativeSlot, 'slot', ['name', 'selected']); hostTree.setSlotableName(rootHost, 'selected');
assert.equal(hostTree.getSlotableName(rootHost), 'selected'); assert.equal(hostTree.findSlotFor(hostedRoot, rootHost), nativeSlot);
assert.equal(hostTree.slotableNameStatistics().namedNodes, 1); hostTree.setSlotableName(rootHost, '');
assert.equal(hostTree.slotableNameStatistics().namedNodes, 0);
const nativeCdata = hostTree.allocate(); hostTree.setData(nativeCdata, '{"kind":4,"value":"cdata"}');
assert.equal(hostTree.getSlotableName(nativeCdata), ''); hostTree.setSlotableName(nativeCdata, 'selected');
assert.equal(hostTree.findSlotFor(hostedRoot, nativeCdata), nativeSlot);
hostTree.append(rootHost, nativeCdata); assert.deepEqual(hostTree.findSlotables(nativeSlot), [nativeCdata]);
assert.deepEqual(hostTree.findFlattenedSlotables(nativeSlot), [nativeCdata]);
const assignmentPlan = hostTree.slotAssignmentPlan(nativeSlot);
assert.deepEqual(assignmentPlan, { changed: true, nodes: [nativeCdata] });
assert.deepEqual(hostTree.cachedSlotables(nativeSlot), []);
hostTree.setSlotAssignment(nativeSlot, assignmentPlan.nodes);
assert.deepEqual(hostTree.cachedSlotables(nativeSlot), [nativeCdata]);
assert.equal(hostTree.assignedNodeCount(nativeSlot), 1);
assert.equal(hostTree.slotAssignmentPlan(nativeSlot).changed, false);
assert.equal(hostTree.slotAssignmentStatistics().entries, 1);
assert.equal(hostTree.slotBacklink(nativeCdata), 0);
hostTree.setSlotBacklink(nativeCdata, nativeSlot);
assert.equal(hostTree.slotBacklink(nativeCdata), nativeSlot);
hostTree.remove(nativeCdata); assert.equal(hostTree.eventParent(nativeCdata), nativeSlot);
assert.equal(hostTree.slotBacklinkStatistics().assignedNodes, 1);
const assignmentDriver = new native.NativeSlotAssignmentDriver(nativeSlot, false);
assert.equal(hostTree.slotAssignmentStep(assignmentDriver).kind, native.SlotAssignmentAction.Signal);
assert.deepEqual(hostTree.cachedSlotables(nativeSlot), [nativeCdata]);
assert.equal(hostTree.queueSlotSignal(nativeSlot), true); assert.equal(hostTree.queueSlotSignal(nativeSlot), false);
assert.equal(hostTree.slotSignalStatistics().pendingSlots, 1);
assert.equal(hostTree.slotAssignmentStep(assignmentDriver).kind, native.SlotAssignmentAction.Applied);
assert.deepEqual(hostTree.cachedSlotables(nativeSlot), []);
assert.equal(hostTree.slotAssignmentStep(assignmentDriver).kind, native.SlotAssignmentAction.Complete);
assert.equal(assignmentDriver.complete, true);
assert.deepEqual(hostTree.takeSlotSignals(), [nativeSlot]);
assert.equal(hostTree.slotSignalStatistics().pendingSlots, 0);
hostTree.queueSlotSignal(nativeSlot);
hostTree.release(nativeCdata);
assert.equal(hostTree.slotBacklinkStatistics().assignedNodes, 0);
assert.deepEqual(hostTree.cachedSlotables(nativeSlot), []);
assert.equal(hostTree.slotAssignmentStatistics().entries, 0);
hostTree.release(nativeSlot);
assert.deepEqual(hostTree.takeSlotSignals(), []); assert.equal(hostTree.slotSignalStatistics().queueCapacity, 0);
hostTree.release(rootHost); assert.equal(hostTree.rootHost(hostedRoot), 0); hostTree.release(hostedRoot);
assert.equal(hostTree.rootHostStatistics().hostedRoots, 0); assert.equal(hostTree.rootHostStatistics().hostOwners, 0);
assert.equal(hostTree.slotBacklinkStatistics().slotOwners, 0);
assert.ok(native.NativeSlotAssignmentDriver.statistics().created > 0);
const mutableRange = rangeState.copy(); mutableRange.applyCharacterData(textHandle, 1, 3, 2);
assert.equal(mutableRange.endOffset, 6); assert.equal(rangeState.endOffset, 7);
assert.equal(mutableRange.applyTreeMutation(native.RangeMutationKind.SplitText, textHandle, namespaceHandle, 2, 0), native.RangeEndpoint.End);
assert.deepEqual(mutableRange.end, { node: namespaceHandle, offset: 4 });
const copiedRangeState = rangeState.copy();
assert.deepEqual(copiedRangeState.collapsePlan(false), { node: textHandle, offset: 7, updateStart: true });
copiedRangeState.setStart(textHandle, 1);
assert.equal(rangeState.startOffset, 0);
assert.equal(tree.compareRangeStates(rangeState, 0, copiedRangeState), native.RangeComparison.Before);
assert.ok(native.NativeRange.statistics().live > 0);
assert.ok(rustdom.getNativeTreeStatistics().rangeStates.live > 0);
tree.release(siblingHandle);
tree.release(textHandle);
tree.release(namespaceHandle);
tree.release(handle);
assert.equal(tree.statistics().liveNodes, 0);
assert.equal(rangeState.endOffset, 7);
