const { buildDirective, handleCors, heuristicDirective, readBody, sendJson } = require('../lib/director');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

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
};
