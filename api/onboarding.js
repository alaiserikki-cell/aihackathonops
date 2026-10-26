'use strict';
const { route } = require('./_lib/http.js');
const { saveOnboarding } = require('./_lib/core.js');

module.exports = route({ POST: (store, id, body) => saveOnboarding(store, id, body) });
