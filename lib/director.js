const fs = require('fs');
const path = require('path');

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function loadLocalEnv(rootDir) {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const cleanLine = line.startsWith('export ') ? line.slice(7).trim() : line;
      const match = cleanLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req, max = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let buf = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error('body-too-large'));
        req.destroy();
        return;
      }
      buf += chunk.toString('utf8');
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

function handleCors(req, res) {
  if (req.method !== 'OPTIONS') return false;
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
  return true;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function normalizePool(raw) {
  const keys = ['normal', 'grasshopper', 'bomb', 'firefly', 'hourglass', 'poison', 'spiral', 'medicinal', 'letter'];
  const out = {};
  let total = 0;
  for (const k of keys) {
    const v = Number(raw && raw[k]);
    if (Number.isFinite(v) && v > 0) {
      out[k] = v;
      total += v;
    }
  }
  if (total <= 0) return null;
  for (const k of Object.keys(out)) out[k] = out[k] / total;
  return out;
}

function sanitizeDirective(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const env = d.environment || {};
  const spawning = d.spawning || {};
  const flies = d.flies || {};
  const rivals = d.rivals || {};
  const pool = normalizePool(spawning.pool_overrides);
  return {
    duration_s: clamp(Number(d.duration_s || 8), 4, 18),
    flavor_text: typeof d.flavor_text === 'string' ? d.flavor_text.slice(0, 48) : '',
    environment: {
      wind_scale: clamp(Number(env.wind_scale || 1), 0.55, 1.6),
      lightning_scale: clamp(Number(env.lightning_scale || 1), 0.5, 2.1),
      darkness_scale: clamp(Number(env.darkness_scale || 1), 0.35, 1.8),
      rain_mode: ['keep', 'on', 'off'].includes(env.rain_mode) ? env.rain_mode : 'keep',
      snow_mode: ['keep', 'on', 'off'].includes(env.snow_mode) ? env.snow_mode : 'keep',
      high_wind_mode: ['keep', 'on', 'off'].includes(env.high_wind_mode) ? env.high_wind_mode : 'keep'
    },
    spawning: {
      cap_delta: Math.round(clamp(Number(spawning.cap_delta || 0), -6, 6)),
      interval_scale: clamp(Number(spawning.interval_scale || 1), 0.62, 1.65),
      extra_chance_delta: clamp(Number(spawning.extra_chance_delta || 0), -0.25, 0.3),
      pool_overrides: pool || {
        normal: 0.36,
        grasshopper: 0.16,
        bomb: 0.1,
        firefly: 0.1,
        hourglass: 0.08,
        poison: 0.1,
        spiral: 0.1,
        medicinal: 0.08
      }
    },
    flies: {
      speed_scale: clamp(Number(flies.speed_scale || 1), 0.72, 1.32),
      frog_pull_scale: clamp(Number(flies.frog_pull_scale || 1), 0.5, 1.6)
    },
    rivals: {
      speed_scale: clamp(Number(rivals.speed_scale || 1), 0.72, 1.35),
      aggression_scale: clamp(Number(rivals.aggression_scale || 1), 0.72, 1.5),
      corner_hop_scale: clamp(Number(rivals.corner_hop_scale || 1), 0.65, 1.6),
      tongue_rate_scale: clamp(Number(rivals.tongue_rate_scale || 1), 0.65, 1.6)
    }
  };
}

function heuristicDirective(gameState) {
  const level = Number(gameState.level || 1);
  const goal = Math.max(1, Number(gameState.goal || 1000));
  const score = Number((gameState.level_score ?? gameState.score) || 0);
  const levelProgress = clamp(score / goal, 0, 1.4);
  const elapsed = Number(gameState.level_elapsed_s || 0);
  const targetTime = Math.max(1, Number(gameState.target_time_s || (14 + level * 4)));
  const pace = clamp(elapsed / targetTime, 0, 1.6);
  const cognitive = gameState.cognitive_profile || {};
  const mastery = Number(cognitive.mastery || 0);
  const control = Number(cognitive.control || 0);
  const curiosity = Number(cognitive.curiosity || 0);
  const risk = Number(cognitive.risk || 0);
  const predictive = Number(cognitive.predictive_play || 0);
  const behind = levelProgress + 0.08 < pace || control < 0.42;
  const dominating = levelProgress > pace + 0.15 && mastery > 0.56;
  const curiosityLow = curiosity < 0.34;
  const pressure = clamp(levelProgress * 0.7 + pace * 0.16 + level * 0.06 + (dominating ? 0.3 : 0) - (behind ? 0.16 : 0), 0, 2.15);
  const flyCount = Number((gameState.flies && gameState.flies.count) || 0);
  const manyFlies = flyCount >= 18;
  const flavor = behind
    ? 'RECOVERY WINDOW'
    : (dominating ? (curiosityLow ? 'PATTERN SHIFT' : 'PRESSURE SPIKE') : (manyFlies ? 'CHAOS SWARM' : 'CURIOUS FLOW'));

  return sanitizeDirective({
    duration_s: 7 + Math.random() * 4,
    flavor_text: flavor,
    environment: {
      wind_scale: behind ? 0.84 : (predictive > 0.56 ? 1.08 : 1 + pressure * 0.08),
      lightning_scale: clamp(0.9 + pressure * 0.45, 0.7, 1.9),
      darkness_scale: level >= 11 ? (behind ? 0.68 : (dominating ? 1.22 : 1.06)) : 1,
      rain_mode: level >= 4 && Math.random() < (curiosityLow ? 0.22 : 0.15) ? 'on' : 'keep',
      snow_mode: level >= 8 && Math.random() < (behind ? 0.06 : 0.12) ? 'on' : 'keep',
      high_wind_mode: level >= 9 && Math.random() < 0.25 ? 'on' : 'keep'
    },
    spawning: {
      cap_delta: behind ? -1 : (manyFlies ? 0 : 2),
      interval_scale: behind ? 1.1 : (dominating ? 0.82 : 0.92),
      extra_chance_delta: behind ? -0.04 : (dominating ? 0.08 : 0.04),
      pool_overrides: {
        normal: clamp(0.4 - pressure * 0.09 + (curiosityLow ? 0.05 : 0), 0.1, 0.54),
        grasshopper: clamp(0.15 + pressure * 0.04 + predictive * 0.05, 0.09, 0.28),
        bomb: clamp(0.07 + pressure * 0.08 + Math.max(0, control - 0.45) * 0.06 - (behind ? 0.04 : 0), 0.02, 0.24),
        firefly: clamp(0.08 + (behind ? 0.08 : 0) + (curiosityLow ? 0.04 : 0), 0.05, 0.24),
        hourglass: clamp(0.06 + (behind ? 0.08 : 0) + (Number(cognitive.adaptability || 0) < 0.42 ? 0.03 : 0), 0.04, 0.18),
        poison: clamp(0.05 + pressure * 0.05 + Math.max(0, mastery - 0.48) * 0.05, 0.02, 0.2),
        spiral: clamp(0.08 + pressure * 0.06 + predictive * 0.04, 0.03, 0.26),
        medicinal: clamp(0.06 + (behind ? 0.07 : 0) + Math.max(0, risk - 0.28) * 0.08, 0.04, 0.22),
        letter: level >= 7 ? clamp(0.06 + (behind ? 0.04 : 0), 0.04, 0.18) : 0
      }
    },
    flies: {
      speed_scale: behind ? 0.93 : (dominating ? 1.12 : 1.04),
      frog_pull_scale: behind ? 0.86 : (predictive > 0.56 ? 1.08 : 1.12)
    },
    rivals: {
      speed_scale: clamp(0.94 + pressure * 0.2 + (dominating ? 0.05 : 0), 0.84, 1.34),
      aggression_scale: clamp(0.92 + pressure * 0.22 + (control > 0.58 ? 0.05 : 0), 0.82, 1.48),
      corner_hop_scale: manyFlies ? 1.08 : (behind ? 0.92 : 1.02),
      tongue_rate_scale: manyFlies ? 1.06 : (behind ? 0.9 : 0.98)
    }
  });
}

async function openAiDirective(gameState) {
  const payload = {
    model: getOpenAiModel(),
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are the AI Director for an ASCII frog arcade game.',
          'Return ONLY JSON with these keys:',
          '{',
          '  "duration_s": number 4..18,',
          '  "flavor_text": short string,',
          '  "environment": { "wind_scale": number, "lightning_scale": number, "darkness_scale": number, "rain_mode": "keep|on|off", "snow_mode": "keep|on|off", "high_wind_mode": "keep|on|off" },',
          '  "spawning": { "cap_delta": integer, "interval_scale": number, "extra_chance_delta": number, "pool_overrides": { normal, grasshopper, bomb, firefly, hourglass, poison, spiral, medicinal, letter } },',
          '  "flies": { "speed_scale": number, "frog_pull_scale": number },',
          '  "rivals": { "speed_scale": number, "aggression_scale": number, "corner_hop_scale": number, "tongue_rate_scale": number }',
          '}',
          'Balance rule: if player is struggling, ease pressure and offer recovery windows. If player dominates, increase challenge.',
          'Use game_state.level_score, game_state.goal, game_state.level_elapsed_s, and game_state.target_time_s to pace the level so levels do not collapse too quickly.',
          'Use game_state.cognitive_profile to read the player style. Increase curiosity with pattern variety, sequencing, timing pressure, support bait, and rival mind-games before only increasing raw speed.',
          'If curiosity is low, introduce more interesting fly mixes and readable twists. If control is low or risk is high, preserve the level theme but create recoverable windows.',
          'On rival levels you may use darkness_scale to create temporary low-visibility pressure, but leave meaningful recovery via fireflies and calmer windows.'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({ game_state: gameState })
      }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let result;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenAiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`openai-${res.status}:${txt.slice(0, 180)}`);
    }
    const body = await res.json();
    const content = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content
      : '{}';
    const parsed = JSON.parse(content || '{}');
    result = sanitizeDirective(parsed);
  } finally {
    clearTimeout(timeout);
  }
  return result;
}

async function buildDirective(gameState) {
  if (!getOpenAiKey()) {
    return { source: 'LOCAL_NO_KEY', directive: heuristicDirective(gameState) };
  }
  try {
    const directive = await openAiDirective(gameState);
    return { source: 'OPENAI', directive };
  } catch (err) {
    return { source: 'LOCAL_FALLBACK', directive: heuristicDirective(gameState), error: String(err.message || err) };
  }
}

module.exports = {
  buildDirective,
  getOpenAiKey,
  getOpenAiModel,
  handleCors,
  heuristicDirective,
  loadLocalEnv,
  readBody,
  sendJson
};
