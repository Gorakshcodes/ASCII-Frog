const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const {
  buildDirective,
  getOpenAiKey,
  getOpenAiModel,
  handleCors,
  heuristicDirective,
  loadLocalEnv,
  readBody,
  sendJson
} = require('./lib/director');

loadLocalEnv(ROOT);

const PORT = Number(process.env.PORT || 3000);

function safePathFromUrl(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/') p = '/index.html';
  const normalized = path.normalize(p).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  return path.join(ROOT, normalized);
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (handleCors(req, res)) return;

  if (req.method === 'GET' && urlObj.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      openai: !!getOpenAiKey(),
      model: getOpenAiModel(),
      director_mode: getOpenAiKey() ? 'OPENAI' : 'LOCAL_FALLBACK'
    });
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/api/director') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const gameState = body.game_state || {};
      const result = await buildDirective(gameState);
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 400, {
        source: 'LOCAL_ERROR',
        directive: heuristicDirective({ level: 1, score: 0, goal: 100 }),
        error: String(err.message || err)
      });
    }
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  const filePath = safePathFromUrl(urlObj.pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => {
      res.writeHead(500);
      res.end('Server Error');
    });
  });
});

server.listen(PORT, () => {
  console.log(`ASCII Frog server running at http://localhost:${PORT}`);
  console.log(`AI Director: ${getOpenAiKey() ? `OPENAI (${getOpenAiModel()})` : 'LOCAL fallback (set OPENAI_API_KEY in .env or your shell to enable OpenAI)'}`);
});
