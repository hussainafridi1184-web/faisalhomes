'use strict';
// Test harness: real PostgreSQL test database + real HTTP server.
const path = require('path');
const fs = require('fs');
const os = require('os');

const TEST_DB = process.env.TEST_DATABASE_URL || 'postgres://postgres@localhost:5432/faisal_homes_test';
process.env.DATABASE_URL = TEST_DB;
process.env.FH_ENV_FILE = path.join(os.tmpdir(), 'fh-nonexistent.env');
const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-test-storage-'));
process.env.STORAGE_DIR = storage;
process.env.DISABLE_SCHEDULER = 'true';

const { Client: PgClient } = require('pg');

async function resetDatabase() {
  const u = new URL(TEST_DB);
  const name = u.pathname.slice(1);
  u.pathname = '/postgres';
  const c = new PgClient({ connectionString: u.toString() });
  await c.connect();
  await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [name]);
  await c.query(`DROP DATABASE IF EXISTS "${name}"`);
  await c.query(`CREATE DATABASE "${name}"`);
  await c.end();
  await require('../src/db/migrate').migrate({ quiet: true });
}

class Api {
  constructor(base) { this.base = base; this.cookie = ''; }
  async req(method, p, body, { csrf = true, form } = {}) {
    const headers = {};
    if (csrf) headers['X-FH-Request'] = '1';
    if (this.cookie) headers.cookie = this.cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(this.base + p, { method, headers, body: payload });
    const sc = r.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
    return { status: r.status, data, headers: r.headers };
  }
  get(p) { return this.req('GET', p); }
  post(p, b = {}) { return this.req('POST', p, b); }
  put(p, b = {}) { return this.req('PUT', p, b); }
  del(p) { return this.req('DELETE', p); }
}

async function startServer() {
  await resetDatabase();
  const { createApp } = require('../src/app');
  const app = createApp();
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { server, base, storage, api: () => new Api(base) };
}

async function stopServer(server) {
  await new Promise((r) => server.close(r));
  await require('../src/db/pool').pool.end();
  fs.rmSync(storage, { recursive: true, force: true });
}

module.exports = { startServer, stopServer, Api };
