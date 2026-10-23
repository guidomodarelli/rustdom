/** @file Captures full checkpoint066/current inputs for a new build, never for historical XML evidence reuse. */
'use strict';
const { createBuildInputsCapture } = require('./current-build-inputs.cjs');
const policy = require('./constants/xml-build-inputs.cjs');
const recipe = require('./constants/xml-hosted-build.cjs');
const captureXmlBuildInputs = createBuildInputsCapture({ recipe, ...policy });
module.exports = { captureXmlBuildInputs };
