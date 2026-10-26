'use strict';
const { route } = require('./_lib/http.js');

module.exports = route({ GET: async store => ({ ok: true, db: store.kind, time: new Date().toISOString() }) }, { workspace: false });
