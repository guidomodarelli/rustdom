"use strict";
require = require("../../../../../private-require.cjs")(require);

const { createMutableRectImplementation } = require("../../../../../dom-rect.cjs");
exports.implementation = createMutableRectImplementation(require("./DOMRectReadOnly-impl").implementation, require("../generated/DOMRect"));
