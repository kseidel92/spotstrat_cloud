const { upstreamBase } = require('../lib/proxy');

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  const base = upstreamBase();
  if (!base) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'home_offline', message: 'HOME_API_URL ausente.' }));
    return;
  }
  try {
    const raw = await readRawBody(req);
    const headers = {
      'content-type': req.headers['content-type'] || 'application/json',
      'stripe-signature': req.headers['stripe-signature'] || '',
      'accept-encoding': 'identity',
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const upstream = await fetch(`${base}/v1/billing/webhook`, {
        method: 'POST',
        headers,
        body: raw,
        signal: ctrl.signal,
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.statusCode = upstream.status;
      res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
      if (body.length) res.setHeader('content-length', String(body.length));
      res.end(body);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('[cloud] stripe webhook', err.message);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      error: 'home_offline',
      message: err?.name === 'AbortError'
        ? 'A API de origem não respondeu a tempo.'
        : 'A API de origem está inacessível.',
    }));
  }
};
