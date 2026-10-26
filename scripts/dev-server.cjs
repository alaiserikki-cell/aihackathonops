// Local stand-in for Vercel: serves dist/ and routes /api/<name> to api/<name>.js.
// Uses the in-memory store unless DATABASE_URL is set. Usage: node scripts/dev-server.cjs [port]
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist'), port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.csv': 'text/csv' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
  if (api) {
    const file = path.join(root, 'api', api[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Not found."}'); }
    // API_DELAY_MS simulates a slow cold start when testing sync timing.
    const delay = Number(process.env.API_DELAY_MS || 0);
    if (delay) await new Promise(r => setTimeout(r, delay));
    return require(file)(req, res);
  }
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname), file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Right Pin dev server on http://localhost:${port} (${process.env.DATABASE_URL ? 'Postgres' : 'in-memory store'})`));
