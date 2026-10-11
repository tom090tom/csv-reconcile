import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['web/index.html', 'text/html']], ['/app.js', ['web/app.js', 'text/javascript']],
  ['/styles.css', ['web/styles.css', 'text/css']], ['/src/csv.js', ['src/csv.js', 'text/javascript']],
  ['/src/reconcile.js', ['src/reconcile.js', 'text/javascript']], ['/src/report.js', ['src/report.js', 'text/javascript']],
  ['/examples/left.csv', ['examples/left.csv', 'text/csv']], ['/examples/right.csv', ['examples/right.csv', 'text/csv']],
  ['/DISCLAIMER.md', ['DISCLAIMER.md', 'text/plain']], ['/SECURITY.md', ['SECURITY.md', 'text/plain']]
]);

export function createAppServer() {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const port = server.address()?.port;
    const localHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origin = request.headers.origin;
    if (!localHosts.has(request.headers.host?.toLowerCase())
      || (origin !== undefined && ![...localHosts].some(host => origin === `http://${host}`))
      || request.headers['sec-fetch-site'] === 'cross-site') {
      response.writeHead(403); response.end('Only local same-origin requests are allowed'); return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end('Method not allowed'); return;
    }
    let asset;
    try { asset = assets.get(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400); response.end('Bad request'); return; }
    if (!asset) { response.writeHead(404); response.end('Not found'); return; }
    try {
      const content = await readFile(new URL(asset[0], root));
      response.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(500); response.end('Unable to load application asset'); }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const { values } = parseArgs({ options: { port: { type: 'string', default: '4173' } } });
    const port = Number(values.port);
    if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口需为 1–65535 的整数。');
    const server = createAppServer();
    server.on('error', error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`CSV Reconcile: http://127.0.0.1:${port}\n文件仅在浏览器处理。按 Ctrl+C 停止。`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
