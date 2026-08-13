// Zero-dependency dev server for Inhibited Abyss.
//
// The reason this exists rather than `python3 -m http.server`: that server sends
// `Last-Modified` but no `Cache-Control`, so browsers fall back to heuristic
// caching for `.js` and `.css`. A normal refresh then re-fetches `index.html`
// and happily reuses every cached ES module underneath it — which looks exactly
// like "the server is still running the old version". This one sends
// `no-store`, so what you load is always what is on disk.
//
//   node tools/serve.mjs [--port 8080] [--host 0.0.0.0]

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { execSync } from 'node:child_process';

const argOf = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PORT = Number(argOf('port', process.env.PORT || 8080));
const HOST = argOf('host', '0.0.0.0');
const ROOT = resolve(argOf('root', process.cwd()));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',   // modules fail outright on the wrong type
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = join(ROOT, rel);
  // Never serve outside the project root.
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  let file = safePath(req.url || '/');
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }

  try {
    let st = statSync(file);
    if (st.isDirectory()) {
      file = join(file, 'index.html');
      st = statSync(file);
    }

    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      // The whole point of this file.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('404 — not found');
  }
});

server.listen(PORT, HOST, async () => {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { /* not a git checkout; fine */ }

  let version = '?';
  try {
    const src = await readFile(join(ROOT, 'src', 'version.js'), 'utf8');
    version = (src.match(/BUILD\s*=\s*'([^']+)'/) || [])[1] || '?';
  } catch { /* fine */ }

  console.log(`Inhibited Abyss — serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  build ${version} · commit ${commit}`);
  console.log('  Cache-Control: no-store — refresh always gets the current files.');
});
