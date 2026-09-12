/** @file Delivers native clone instructions into the existing DOM creation and mutation hooks. */
'use strict';
const { NativeRangeClone, RangeCloneAction } = require('../../dist/native.cjs');
const { BOUNDARY_ROOT_ERROR_MESSAGE } = require('./range-errors.cjs');
/** Store roots on the opaque native wrapper so V8 can trace them across every native call. */
const CLONE_ROOTS = Symbol('rustdom range clone roots');

/**
 * Keep source/result ownership visible to V8 while Rust controls the operation.
 * @param {object} tree - Private native symbol tree.
 * @param {object} range - Real Range implementation.
 * @param {object} fragmentFactory - Existing DocumentFragment WebIDL factory.
 * @param {Function} cloneNode - Existing node clone helper, including custom-element hooks.
 * @param {object} exceptionFactory - Existing DOMException factory.
 * @returns {object} Fragment in the Range's original realm.
 */
function cloneContents(tree, range, fragmentFactory, cloneNode, exceptionFactory) {
  const globalObject = range._globalObject;
  const operation = new NativeRangeClone(range._nativeRange);
  const pins = operation[CLONE_ROOTS] = [range._rangeStartNode, range._rangeEndNode];
  let created = 0;
  try {
    for (;;) {
      const instruction = tree._arena.rangeCloneStep(operation, created);
      created = 0;
      switch (instruction.kind) {
        case RangeCloneAction.CreateFragment: {
          const fragment = fragmentFactory.createImpl(globalObject, [], { ownerDocument: tree._object(instruction.node)._ownerDocument });
          pins.push(fragment); created = tree._ensure(fragment); break;
        }
        case RangeCloneAction.CloneNode: {
          const cloned = cloneNode(tree._object(instruction.node), undefined, instruction.deep ? true : undefined);
          pins.push(cloned); created = tree._ensure(cloned); break;
        }
        case RangeCloneAction.SliceData: {
          const node = tree._object(instruction.node);
          node._data = node.substringData(instruction.offset, instruction.count); break;
        }
        case RangeCloneAction.AppendChild:
          tree._object(instruction.parent).appendChild(tree._object(instruction.node)); break;
        case RangeCloneAction.PinNodes:
          for (const id of instruction.nodes) pins.push(tree._object(id)); break;
        case RangeCloneAction.Complete: return tree._object(instruction.node);
        case RangeCloneAction.InvalidDoctype:
          throw exceptionFactory.create(globalObject, ['Invalid document type element.', 'HierarchyRequestError']);
        case RangeCloneAction.InconsistentRoots:
          throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
        default: throw new Error(`NativeRangeClone: unsupported instruction ${instruction.kind}`);
      }
    }
  } finally {
    operation.cancel(); pins.length = 0; delete operation[CLONE_ROOTS];
  }
}

module.exports = { cloneContents };
