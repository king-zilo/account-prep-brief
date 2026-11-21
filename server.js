import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The app runs fully in the browser; this server only serves docs/ for local use.
const SITE_DIR = fileURLToPath(new URL('./docs', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function handle(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405).end('Method not allowed');
    return;
  }
  const { pathname } = new URL(req.url, 'http://localhost');
  let relative;
  try {
    relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  } catch {
    res.writeHead(400).end('Bad path');
    return;
  }
  const filePath = normalize(join(SITE_DIR, relative));
  if (!filePath.startsWith(SITE_DIR + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

export function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      res.writeHead(500).end('Internal server error');
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Account Prep Brief running at http://localhost:${port}`));
}
