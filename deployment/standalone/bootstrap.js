#!/usr/bin/env node
/**
 * Standalone first-boot bootstrap (replaces psql/pg_isready calls).
 *
 *   node bootstrap.js wait             — wait for DB (max 60s)
 *   node bootstrap.js seed-if-empty    — apply /app/bootstrap-schema.sql if public schema is empty
 *
 * Uses the `pg` driver already in the backend's node_modules — no extra OS packages required.
 */
const fs = require('fs');
const path = require('path');

// Resolve pg from the backend workspace (pnpm symlink topology)
const pgPath = require.resolve('pg', {
  paths: ['/app/packages/backend/node_modules', '/app/node_modules'],
});
const { Client } = require(pgPath);

const cfg = {
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'glide_hims',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'glide_hims',
};

function log(msg) { console.log(`[bootstrap] ${msg}`); }

async function tryConnect(timeoutMs = 2000) {
  const c = new Client({ ...cfg, connectionTimeoutMillis: timeoutMs });
  try {
    await c.connect();
    await c.query('SELECT 1');
    await c.end();
    return true;
  } catch (e) {
    try { await c.end(); } catch {}
    return false;
  }
}

async function waitForDb() {
  log(`Waiting for ${cfg.host}:${cfg.port}/${cfg.database} ...`);
  for (let i = 0; i < 60; i++) {
    if (await tryConnect()) { log('Database reachable'); return; }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('[bootstrap] Database never came up'); process.exit(1);
}

async function seedIfEmpty() {
  if (process.env.SKIP_BOOTSTRAP === '1') { log('SKIP_BOOTSTRAP=1'); return; }
  const schemaFile = '/app/bootstrap-schema.sql';
  if (!fs.existsSync(schemaFile)) { log('WARN: bootstrap-schema.sql missing'); return; }

  const c = new Client(cfg);
  await c.connect();
  try {
    const { rows } = await c.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'"
    );
    const n = rows[0]?.n ?? 0;
    if (n > 0) { log(`Database has ${n} tables — skipping bootstrap`); return; }
    log('Empty database — applying bootstrap schema');
    let sql = fs.readFileSync(schemaFile, 'utf8');
    // Strip psql meta-commands (\restrict, \unrestrict, \connect, ...) — node-postgres can't parse them.
    sql = sql.split('\n').filter(line => !/^\\[a-zA-Z]/.test(line)).join('\n');
    // node-postgres simpleQuery supports multi-statement scripts including $$ ... $$ blocks.
    await c.query(sql);
    log('Bootstrap schema applied');
  } finally {
    await c.end();
  }
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'wait') return waitForDb();
  if (cmd === 'seed-if-empty') return seedIfEmpty();
  console.error(`Usage: bootstrap.js <wait|seed-if-empty>`); process.exit(2);
})().catch(err => { console.error('[bootstrap] FAIL:', err.message); process.exit(1); });
