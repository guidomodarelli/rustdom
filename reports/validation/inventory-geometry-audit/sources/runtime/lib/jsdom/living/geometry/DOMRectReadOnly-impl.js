"use strict";
require = require("../../../../../private-require.cjs")(require);

const { createReadOnlyRectImplementation } = require("../../../../../dom-rect.cjs");
exports.implementation = createReadOnlyRectImplementation(require("../generated/DOMRectReadOnly"));
