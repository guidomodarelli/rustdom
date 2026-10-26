'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

/**
 * Initialize the producer-owned layout before copying its source snapshot.
 * The snapshot implementation supplied by the caller is the real reviewed source API, not a test replacement.
 * @param {object} origin - Actual source identity and graph returned by the source API.
 * @param {string} destination - Existing fresh, producer-owned destination.
 * @param {object} source - Actual source API exposing snapshot(origin, destination).
 * @param {object} io - Actual bounded IO API exposing writeNewJSON.
 * @returns {object} Owned workspace paths. No worker or DOM code is executed.
 */
function prepareWorkspace(origin,destination,source,io){
  const status=fs.lstatSync(destination);
  assert.ok(status.isDirectory()&&!status.isSymbolicLink(),'Workspace requires an owned physical directory');
  const inputs=path.join(destination,'inputs');
  const workers=path.join(destination,'workers');
  fs.mkdirSync(inputs);fs.mkdirSync(workers);
  const snapshot=source.snapshot(origin,destination);
  io.writeNewJSON(path.join(destination,'method-snapshot.json'),snapshot);
  return{inputs,workers,snapshot};
}
module.exports={prepareWorkspace};
