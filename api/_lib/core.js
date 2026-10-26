// Workspace operations. Every decision comes from dist/engine.js, the same code the browser runs.
'use strict';
const E = require('../../dist/engine.js');
const Bot = require('../../dist/bot.js');

// The brand's 10 existing stores (Sheet 3 of the case template). Fixed; uploads cannot change them.
const STORES = [['ST-01','Bengaluru','560001',2019],['ST-02','Bengaluru','560034',2020],['ST-03','Bengaluru','560038',2021],['ST-04','Bengaluru','560066',2022],['ST-05','Bengaluru','560076',2023],['ST-06','Mysuru','570009',2021],['ST-07','Mysuru','570017',2024],['ST-08','Mangaluru','575001',2022],['ST-09','Hubballi-Dharwad','580020',2023],['ST-10','Belagavi','590001',2024]]
  .map(([id, city, pin, year]) => ({ id, city, pin, year }));
const MAX_APPS = 5000, MAX_AUDIT = 200;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = m => new HttpError(400, m), blocked = m => new HttpError(409, m);

const assess = (apps, territories, settings) => E.assess(apps, territories, STORES, {}, settings);
const summarise = results => results.map(r => ({ key: r.key, id: r.id, name: r.name, status: r.status, decision: E.decision(r), score: r.score, high: r.high, territory: r.territory }));

async function loadState(db, id) {
  const ws = await db.getWorkspace(id);
  if (!ws) return { workspace: null, apps: [], territories: [], onboarding: {}, results: [] };
  const [apps, territories, onboarding] = await Promise.all([db.listApps(id), db.listTerritories(id), db.listOnboarding(id)]);
  const { audit, ...workspace } = ws;
  return { workspace, audit, apps, territories, onboarding, results: summarise(assess(apps, territories, ws.settings)) };
}

async function requireWorkspace(db, id) {
  const ws = await db.getWorkspace(id);
  if (!ws) throw bad('This workspace has no data yet. Upload a workbook first.');
  return ws;
}

async function log(db, id, ws, text) {
  const audit = [{ at: new Date().toISOString(), text }, ...(ws.audit || [])].slice(0, MAX_AUDIT);
  await db.setAudit(id, audit);
}

function cleanSettings(settings) {
  const s = { ...E.defaultPolicy, ...(settings || {}), model: 'industry-v2' };
  for (const k of ['minInvestment', 'minArea', 'minLaunch', 'targetLaunch']) s[k] = Number(s[k]);
  const errors = E.policyErrors(s);
  if (errors.length) throw bad('Invalid policy: ' + errors.join(' '));
  return s;
}

function cleanOnboarding(input, keys) {
  const out = {};
  for (const [key, r] of Object.entries(input || {})) {
    if (!keys.has(key) || !r || typeof r !== 'object') continue;
    out[key] = { tasks: {}, taskDates: {} };
    for (const [i, v] of Object.entries(r.tasks || {})) if (/^[0-6]$/.test(i) && typeof v === 'boolean') out[key].tasks[i] = v;
    for (const [i, v] of Object.entries(r.taskDates || {})) if (/^[0-6]$/.test(i) && typeof v === 'string' && /^$|^\d{4}-\d{2}-\d{2}$/.test(v)) out[key].taskDates[i] = v;
  }
  return out;
}

// Replace the workspace with an upload, the sample data, or the browser's local copy.
async function importWorkspace(db, id, body) {
  const { apps, territories, source = 'Upload', warnings = [] } = body || {};
  if (!Array.isArray(apps) || !Array.isArray(territories)) throw bad('Send apps and territories as arrays.');
  if (!apps.length) throw bad('No applications to import.');
  if (apps.length > MAX_APPS) throw bad(`Too many applications (${apps.length}); the limit is ${MAX_APPS}.`);
  const settings = cleanSettings(body.settings);
  const candidate = { source: String(source).slice(0, 200), apps, territories, reference: E.benchmarks(apps), settings, tasks: {}, taskDates: {}, audit: [], warnings: Array.isArray(warnings) ? warnings.map(String).slice(0, 50) : [] };
  if (!E.validState(candidate)) throw bad('The workspace data is not valid. Re-upload the workbook in the template format.');
  const onboarding = cleanOnboarding(body.onboarding, new Set(apps.map(a => a.key)));
  await db.saveWorkspace(id, { source: candidate.source, settings, warnings: candidate.warnings, audit: [] });
  await db.replaceData(id, apps, territories, onboarding);
  const ws = await db.getWorkspace(id);
  await log(db, id, ws, `Imported ${apps.length} applications and ${territories.length} territories from ${candidate.source}.`);
  return loadState(db, id);
}

// Apply confirmed field changes to one application, reassess everyone, and report before -> after and knock-on effects.
async function patchApplication(db, id, { key, patch, why } = {}) {
  const ws = await requireWorkspace(db, id);
  if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) throw bad('Send at least one field to change.');
  const apps = await db.listApps(id), app = apps.find(a => a.key === key);
  if (!app) throw bad('Unknown application.');
  for (const [f, v] of Object.entries(patch)) {
    if (!E.fields.includes(f)) throw bad(`"${f}" is not a template field.`);
    if (v === null) continue;
    if (E.numeric.includes(f) ? !(Number.isFinite(v) && v >= 0) : !(typeof v === 'string' && v.length <= 2000)) throw bad(`Invalid value for ${E.labels[f]}.`);
  }
  const territories = await db.listTerritories(id), before = assess(apps, territories, ws.settings);
  const changed = Object.fromEntries(Object.entries(patch).filter(([f, v]) => app[f] !== v));
  Object.assign(app, patch);
  app.pending = app.pending.filter(p => !(p.field in patch));
  const after = assess(apps, territories, ws.settings), summary = Bot.changeSummary(before, after, key);
  await db.putApp(id, app);
  const onboarding = await db.listOnboarding(id);
  if (onboarding[key]) await db.putOnboarding(id, key, { ...onboarding[key], tasks: E.invalidateTasks(onboarding[key].tasks, changed) });
  await log(db, id, ws, `${app.id || key}: ${String(why || 'Confirmed update').slice(0, 200)}. ${E.decision(summary.before).label} → ${E.decision(summary.after).label}.`);
  return { state: await loadState(db, id), summary: { text: summary.text, affected: summary.affected.map(a => a.id) } };
}

async function saveSettings(db, id, { settings } = {}) {
  const ws = await requireWorkspace(db, id), clean = cleanSettings(settings);
  await db.saveWorkspace(id, { source: ws.source, settings: clean, warnings: ws.warnings, audit: ws.audit });
  await log(db, id, ws, 'Updated brand requirements and reassessed all applications.');
  return loadState(db, id);
}

// Onboarding checklist: steps in order, only for partners moving forward, training needs a confirmed language.
async function saveOnboarding(db, id, { key, tasks, taskDates } = {}) {
  const ws = await requireWorkspace(db, id), apps = await db.listApps(id), territories = await db.listTerritories(id);
  const result = assess(apps, territories, ws.settings).find(r => r.key === key);
  if (!result) throw bad('Unknown application.');
  const current = (await db.listOnboarding(id))[key] || { tasks: {}, taskDates: {} };
  const next = cleanOnboarding({ [key]: { tasks: tasks ?? current.tasks, taskDates: taskDates ?? current.taskDates } }, new Set([key]))[key];
  const done = i => next.tasks[i] === true;
  if (tasks) {
    const anyDone = Object.values(next.tasks).some(Boolean);
    if (anyDone && result.status !== 'Recommended') throw blocked(`${result.id} is "${E.decision(result).label}". Onboarding starts only for Approve or Conditional partners.`);
    for (let i = 1; i < 7; i++) if (done(i) && !done(i - 1)) throw blocked(`Complete step ${i} before step ${i + 1}.`);
    if (done(5) && !['Kannada', 'English', 'Hindi'].includes(result.language)) throw blocked('Confirm the training language before marking training complete.');
  }
  await db.putOnboarding(id, key, next);
  if (tasks) {
    const changedStep = [0, 1, 2, 3, 4, 5, 6].find(i => Boolean(current.tasks[i]) !== done(i));
    if (changedStep !== undefined) await log(db, id, ws, `${result.id}: step ${changedStep + 1} ${done(changedStep) ? 'completed' : 'reopened'}.`);
  }
  return loadState(db, id);
}

async function resetWorkspace(db, id) { await db.reset(id); return loadState(db, id); }

module.exports = { STORES, HttpError, loadState, importWorkspace, patchApplication, saveSettings, saveOnboarding, resetWorkspace };
