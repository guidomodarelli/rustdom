/** @file Preserves the frozen ownership HTML input; original public hashes verify its observable result. */
'use strict';
const settings = require('./constants/fixtures.json').htmlFixture;
module.exports = function fixtureHtml(size) {
  return settings.prefix + Array.from({ length: size }, (unused, index) =>
    `<tr class="row" data-index="${index}"><td><a href="${settings.hrefPrefix}${index}">${settings.rowTextPrefix}${index}${settings.rowTextSuffix}</a></td><td>${index}</td></tr>`).join('') + settings.suffix;
};
