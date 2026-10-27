/** @file Exercises package provenance through the normal Vitest environment. */
import { test } from 'vitest';
import registerProvenance from './suite-provenance.cjs';
registerProvenance(test, () => document);
