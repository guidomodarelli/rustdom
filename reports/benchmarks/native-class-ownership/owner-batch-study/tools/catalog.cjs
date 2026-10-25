/** @file Declare current producer dependencies without querying Git or executing a DOM workload. */
'use strict';
const { currentFiles } = require('../source.cjs');
process.stdout.write(JSON.stringify(currentFiles(), null, 2) + '\n');
