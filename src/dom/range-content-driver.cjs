/** @file Delivers shared native content instructions into existing DOM creation and mutation hooks. */
'use strict';
const { NativeRangeClone, RangeCloneAction, NativeRangeExtract, RangeExtractAction } = require('../../dist/native.cjs');
const { BOUNDARY_ROOT_ERROR_MESSAGE } = require('./range-errors.cjs');
/** Store roots on the opaque native wrapper so V8 can trace them across every native call. */
const CONTENT_ROOTS = Symbol('rustdom range content roots');
/** Each adapter keeps its own public instruction vocabulary and controller lifetime. */
const OPERATIONS = {
  clone: { Constructor: NativeRangeClone, actions: RangeCloneAction, step: 'rangeCloneStep', name: 'NativeRangeClone' },
  extract: { Constructor: NativeRangeExtract, actions: RangeExtractAction, step: 'rangeExtractStep', name: 'NativeRangeExtract' },
};

/**
 * Keep source/result ownership visible to V8 while Rust controls the operation.
 * @param {object} tree - Private native symbol tree.
 * @param {object} range - Real Range implementation.
 * @param {object} fragmentFactory - Existing DocumentFragment WebIDL factory.
 * @param {Function} cloneNode - Existing node clone helper, including custom-element hooks.
 * @param {object} exceptionFactory - Existing DOMException factory.
 * @param {'clone'|'extract'} mode - Requested public content operation.
 * @returns {object} Fragment in the Range's original realm.
 */
function runContents(tree, range, fragmentFactory, cloneNode, exceptionFactory, mode) {
  const globalObject = range._globalObject;
  const config = OPERATIONS[mode]; const actions = config.actions;
  const operation = new config.Constructor(range._nativeRange);
  const pins = operation[CONTENT_ROOTS] = [range._rangeStartNode, range._rangeEndNode];
  let created = 0;
  try {
    for (;;) {
      const instruction = tree._arena[config.step](operation, created);
      created = 0;
      switch (instruction.kind) {
        case actions.CreateFragment: {
          const fragment = fragmentFactory.createImpl(globalObject, [], { ownerDocument: tree._object(instruction.node)._ownerDocument });
          pins.push(fragment); created = tree._ensure(fragment); break;
        }
        case actions.CloneNode: {
          const cloned = cloneNode(tree._object(instruction.node), undefined, instruction.deep ? true : undefined);
          pins.push(cloned); created = tree._ensure(cloned); break;
        }
        case actions.SliceData: {
          const node = tree._object(instruction.node);
          node._data = node.substringData(instruction.offset, instruction.count); break;
        }
        case actions.AppendChild:
          tree._object(instruction.parent).appendChild(tree._object(instruction.node)); break;
        case actions.PinNodes:
          for (const id of instruction.nodes) pins.push(tree._object(id)); break;
        case actions.ReplaceData:
          tree._object(instruction.node).replaceData(instruction.offset, instruction.count, ''); break;
        case actions.Complete: {
          const fragment = tree._object(instruction.node);
          if (instruction.parent !== 0) {
            const node = tree._object(instruction.parent);
            range._setLiveRangeStart(node, instruction.offset); range._setLiveRangeEnd(node, instruction.offset);
          }
          return fragment;
        }
        case actions.InvalidDoctype:
          throw exceptionFactory.create(globalObject, ['Invalid document type element.', 'HierarchyRequestError']);
        case actions.InconsistentRoots:
          throw new Error(BOUNDARY_ROOT_ERROR_MESSAGE);
        default: throw new Error(`${config.name}: unsupported instruction ${instruction.kind}`);
      }
    }
  } finally {
    operation.cancel(); pins.length = 0; delete operation[CONTENT_ROOTS];
  }
}

module.exports = { runContents };
