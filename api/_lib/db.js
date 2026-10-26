// Storage for Right Pin. Postgres on Neon when DATABASE_URL is set, otherwise an in-memory store (local dev and tests).
// Both adapters expose the same async methods, so the rest of the server never knows which one it is using.
'use strict';

const SCHEMA = [
  `create table if not exists workspaces (
     id uuid primary key,
     source text not null default '',
     settings jsonb not null,
     warnings jsonb not null default '[]',
     audit jsonb not null default '[]',
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now())`,
  `create table if not exists applications (
     workspace_id uuid not null references workspaces(id) on delete cascade,
     key text not null,
     position int not null,
     data jsonb not null,
     primary key (workspace_id, key))`,
  `create table if not exists territories (
     workspace_id uuid not null references workspaces(id) on delete cascade,
     position int not null,
     data jsonb not null,
     primary key (workspace_id, position))`,
  `create table if not exists onboarding (
     workspace_id uuid not null references workspaces(id) on delete cascade,
     app_key text not null,
     tasks jsonb not null default '{}',
     task_dates jsonb not null default '{}',
     primary key (workspace_id, app_key))`
];

const iso = d => (d instanceof Date ? d : new Date(d)).toISOString();

function memoryAdapter() {
  const store = globalThis.__rightPinMemory || (globalThis.__rightPinMemory = new Map());
  const ws = id => store.get(id);
  const touch = w => { w.updatedAt = new Date().toISOString(); };
  return {
    kind: 'memory',
    async init() {},
    async getWorkspace(id) {
      let w = ws(id);
      return w ? structuredClone({ id, source: w.source, settings: w.settings, warnings: w.warnings, audit: w.audit, createdAt: w.createdAt, updatedAt: w.updatedAt }) : null;
    },
    async saveWorkspace(id, { source, settings, warnings, audit }) {
      let w = ws(id);
      if (!w) store.set(id, w = { apps: [], territories: [], onboarding: {}, createdAt: new Date().toISOString() });
      Object.assign(w, structuredClone({ source, settings, warnings, audit }));
      touch(w);
    },
    async replaceData(id, apps, territories, onboarding) {
      Object.assign(ws(id), structuredClone({ apps, territories, onboarding }));
    },
    async listApps(id) { return structuredClone(ws(id)?.apps || []); },
    async putApp(id, app) {
      let w = ws(id), i = w.apps.findIndex(a => a.key === app.key);
      if (i >= 0) w.apps[i] = structuredClone(app);
      touch(w);
    },
    async listTerritories(id) { return structuredClone(ws(id)?.territories || []); },
    async listOnboarding(id) { return structuredClone(ws(id)?.onboarding || {}); },
    async putOnboarding(id, key, record) { ws(id).onboarding[key] = structuredClone(record); touch(ws(id)); },
    async setAudit(id, audit) { ws(id).audit = structuredClone(audit); },
    async reset(id) { store.delete(id); }
  };
}

function neonAdapter(url) {
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);
  const q = (text, params = []) => sql.query(text, params);
  let ready = null;
  return {
    kind: 'neon',
    init() { return ready || (ready = (async () => { for (const s of SCHEMA) await q(s); })().catch(e => { ready = null; throw e; })); },
    async getWorkspace(id) {
      let [w] = await q('select id, source, settings, warnings, audit, created_at, updated_at from workspaces where id = $1', [id]);
      return w ? { id: w.id, source: w.source, settings: w.settings, warnings: w.warnings, audit: w.audit, createdAt: iso(w.created_at), updatedAt: iso(w.updated_at) } : null;
    },
    async saveWorkspace(id, { source, settings, warnings, audit }) {
      await q(`insert into workspaces (id, source, settings, warnings, audit) values ($1, $2, $3, $4, $5)
               on conflict (id) do update set source = excluded.source, settings = excluded.settings, warnings = excluded.warnings,
                 audit = excluded.audit, updated_at = now()`,
        [id, source, JSON.stringify(settings), JSON.stringify(warnings), JSON.stringify(audit)]);
    },
    async replaceData(id, apps, territories, onboarding) {
      // Runs as one transaction; rows are inserted from JSON arrays so a large upload stays a single round trip.
      await sql.transaction([
        sql.query('delete from applications where workspace_id = $1', [id]),
        sql.query('delete from territories where workspace_id = $1', [id]),
        sql.query('delete from onboarding where workspace_id = $1', [id]),
        sql.query(`insert into applications (workspace_id, key, position, data)
                   select $1, e->>'key', (ord - 1)::int, e from jsonb_array_elements($2::jsonb) with ordinality as t(e, ord)`, [id, JSON.stringify(apps)]),
        sql.query(`insert into territories (workspace_id, position, data)
                   select $1, (ord - 1)::int, e from jsonb_array_elements($2::jsonb) with ordinality as t(e, ord)`, [id, JSON.stringify(territories)]),
        sql.query(`insert into onboarding (workspace_id, app_key, tasks, task_dates)
                   select $1, k, coalesce(v->'tasks', '{}'), coalesce(v->'taskDates', '{}') from jsonb_each($2::jsonb) as t(k, v)`, [id, JSON.stringify(onboarding)])
      ]);
    },
    async listApps(id) { return (await q('select data from applications where workspace_id = $1 order by position', [id])).map(r => r.data); },
    async putApp(id, app) {
      await sql.transaction([
        sql.query('update applications set data = $3 where workspace_id = $1 and key = $2', [id, app.key, JSON.stringify(app)]),
        sql.query('update workspaces set updated_at = now() where id = $1', [id])
      ]);
    },
    async listTerritories(id) { return (await q('select data from territories where workspace_id = $1 order by position', [id])).map(r => r.data); },
    async listOnboarding(id) {
      let rows = await q('select app_key, tasks, task_dates from onboarding where workspace_id = $1', [id]);
      return Object.fromEntries(rows.map(r => [r.app_key, { tasks: r.tasks, taskDates: r.task_dates }]));
    },
    async putOnboarding(id, key, r) {
      await q(`insert into onboarding (workspace_id, app_key, tasks, task_dates) values ($1, $2, $3, $4)
               on conflict (workspace_id, app_key) do update set tasks = excluded.tasks, task_dates = excluded.task_dates`,
        [id, key, JSON.stringify(r.tasks), JSON.stringify(r.taskDates)]);
    },
    async setAudit(id, audit) { await q('update workspaces set audit = $2, updated_at = now() where id = $1', [id, JSON.stringify(audit)]); },
    async reset(id) { await q('delete from workspaces where id = $1', [id]); }
  };
}

let adapter = null;
function db() {
  if (!adapter) adapter = process.env.DATABASE_URL ? neonAdapter(process.env.DATABASE_URL) : memoryAdapter();
  return adapter;
}

module.exports = { db, memoryAdapter };
