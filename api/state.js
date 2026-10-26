'use strict';
const { route } = require('./_lib/http.js');
const { loadState } = require('./_lib/core.js');

module.exports = route({ GET: (store, id, body) => loadState(store, id) });
