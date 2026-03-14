const { getOpenAiKey, getOpenAiModel, handleCors, sendJson } = require('../lib/director');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  sendJson(res, 200, {
    ok: true,
    openai: !!getOpenAiKey(),
    model: getOpenAiModel(),
    director_mode: getOpenAiKey() ? 'OPENAI' : 'LOCAL_FALLBACK'
  });
};
