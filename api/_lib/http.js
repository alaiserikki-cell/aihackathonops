// Small wrapper shared by every API route: method check, workspace header, JSON body, error mapping.
'use strict';
const { db } = require('./db.js');
const { HttpError } = require('./core.js');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 4 * 1024 * 1024;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? (req.body ? JSON.parse(req.body) : {}) : req.body || {};
  let size = 0, chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new HttpError(413, 'Request is too large.'); chunks.push(c); }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

// route({ GET: fn, POST: fn }, { workspace: true }) -> Vercel/Node handler. fn(store, workspaceId, body) returns the JSON reply.
function route(methods, { workspace = true } = {}) {
  return async (req, res) => {
    try {
      const fn = methods[req.method];
      if (!fn) { res.setHeader('allow', Object.keys(methods).join(', ')); return send(res, 405, { error: 'Method not allowed.' }); }
      const id = req.headers['x-workspace-id'];
      if (workspace && !UUID.test(String(id || ''))) return send(res, 400, { error: 'Missing or invalid x-workspace-id header.' });
      let body = {};
      if (req.method === 'POST') { try { body = await readBody(req); } catch (e) { if (e instanceof HttpError) throw e; return send(res, 400, { error: 'Body must be JSON.' }); } }
      const store = db();
      await store.init();
      send(res, 200, await fn(store, id && String(id).toLowerCase(), body));
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Server error. Your work is still saved in this browser.' });
    }
  };
}

module.exports = { route, send };
