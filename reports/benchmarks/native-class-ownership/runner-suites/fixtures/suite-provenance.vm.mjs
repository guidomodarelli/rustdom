/** @file Exercises package provenance independently in both actual Vitest VM pools. */
import { test } from 'vitest';
import registerProvenance from './suite-provenance.cjs';
registerProvenance(test, () => document);
