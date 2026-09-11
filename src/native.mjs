/** @module rustdom/native Exposes explicit ESM names for the real Node-API addon. */
import native from './native.cjs';
export const { NativeTree, QueryMode, AttributeField, parseDocumentTape, parseFragmentTape } = native;
export default native;
