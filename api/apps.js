'use strict';
const { route } = require('./_lib/http.js');
const { patchApplication } = require('./_lib/core.js');

module.exports = route({ POST: (store, id, body) => patchApplication(store, id, body) });
