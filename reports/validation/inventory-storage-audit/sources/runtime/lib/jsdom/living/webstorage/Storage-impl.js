"use strict";
require = require("../../../../../private-require.cjs")(require);

const { createStorageImplementation } = require("../../../../../web-storage.cjs");
exports.implementation = createStorageImplementation(require("../generated/DOMException"), require("../generated/StorageEvent"), require("../generated/utils"), require("../helpers/events").fireAnEvent);
