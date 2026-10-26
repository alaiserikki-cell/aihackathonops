'use strict';
const { route } = require('./_lib/http.js');
const { resetWorkspace } = require('./_lib/core.js');

module.exports = route({ POST: (store, id, body) => resetWorkspace(store, id) });
