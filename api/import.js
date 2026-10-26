'use strict';
const { route } = require('./_lib/http.js');
const { importWorkspace } = require('./_lib/core.js');

module.exports = route({ POST: (store, id, body) => importWorkspace(store, id, body) });
