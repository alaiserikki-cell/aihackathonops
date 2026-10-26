'use strict';
const { route } = require('./_lib/http.js');
const { saveSettings } = require('./_lib/core.js');

module.exports = route({ POST: (store, id, body) => saveSettings(store, id, body) });
