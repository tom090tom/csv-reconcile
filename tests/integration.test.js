import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createAppServer } from '../bin/server.js';
import { parseCSV } from '../src/csv.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = ['examples/left.csv', 'examples/right.csv', '--left-key', '订单号', '--left-amount', '金额', '--right-key', 'order_id', '--right-amount', 'amount'];
const cli = extra => spawnSync(process.execPath, ['bin/reconcile.js', ...extra], { cwd: root, encoding: 'utf8' });

test('CLI reconciles the complete demo and emits a CSV report', () => {
  const result = cli(args);
  assert.equal(result.status, 0, result.stderr);
  const report = parseCSV(result.stdout);
  assert.equal(report.rows.length, 5);
  assert.deepEqual(new Set(report.rows.map(row => row[0])), new Set(['一致', '金额差异', '仅左表', '仅右表', '重复订单']));
});
test('CLI invalid mapping exits with a useful error rather than a stack trace', () => {
  const result = cli(args.map(value => value === '订单号' ? 'missing' : value));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /左表/);
  assert.doesNotMatch(result.stderr, /at file:/);
});
test('CLI requires mappings and documents usage', () => {
  assert.notEqual(cli(['examples/left.csv', 'examples/right.csv']).status, 0);
  const help = cli(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /left-key/);
});
test('CLI never overwrites an existing output file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'csv-reconcile-test-'));
  try {
    const path = join(directory, 'report.csv');
    await writeFile(path, 'keep me');
    const result = cli([...args, '--output', path]);
    assert.equal(result.status, 1);
    assert.equal(await readFile(path, 'utf8'), 'keep me');
  } finally { await rm(directory, { recursive: true }); }
});
test('CLI rejects invalid UTF-8 rather than silently corrupting identifiers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'csv-reconcile-test-'));
  try {
    const path = join(directory, 'bad.csv');
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x00]));
    const result = cli([path, ...args.slice(1)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /UTF-8/);
  } finally { await rm(directory, { recursive: true }); }
});

test('local server serves only public application assets and rejects uploads', async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /CSV Reconcile/);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal((await fetch(`${base}/src/reconcile.js`)).status, 200);
    assert.equal((await fetch(`${base}/examples/left.csv`)).status, 200);
    for (const path of ['/.git/config', '/AGENTS.md', '/package.json', '/..%2f..%2f个人资料/账号定位.md']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base, { method: 'POST', body: 'private csv' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

async function localRequest(server, headers) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path: '/', headers }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.end();
  });
}

for (const [name, headers] of [
  ['foreign Host', { Host: 'attacker.example' }],
  ['wrong local port', { Host: 'localhost:1' }],
  ['foreign Origin', { Origin: 'https://attacker.example' }],
  ['opaque Origin', { Origin: 'null' }],
  ['cross-site browser request', { 'Sec-Fetch-Site': 'cross-site' }]
]) test(`local server rejects ${name}`, async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { assert.equal(await localRequest(server, headers), 403); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
test('local server accepts matching local origins and sets privacy response headers', async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(origin, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
