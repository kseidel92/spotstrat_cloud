const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

/** fetch() decompresses gzip/br; forwarding these headers breaks browsers. */
const STRIP_FROM_UPSTREAM = new Set([
  ...HOP_BY_HOP,
  'content-encoding',
  'content-length',
]);

function upstreamBase() {
  return (process.env.HOME_API_URL || '').replace(/\/$/, '');
}

function wsOriginFromHome(home = upstreamBase()) {
  if (!home) return null;
  return home.replace(/^http/i, 'ws');
}

const UPSTREAM_MS = 8000;

function pathTail(req) {
  const parts = req.query?.path;
  if (parts != null && parts !== '') {
    return Array.isArray(parts) ? parts.join('/') : String(parts);
  }
  const pathOnly = (req.url || '').split('?')[0];
  const fromV1 = pathOnly.match(/\/v1\/(.*)$/);
  return fromV1 ? fromV1[1] : '';
}

function buildTarget(req) {
  const base = upstreamBase();
  if (!base) return null;
  const tail = pathTail(req);
  const raw = req.url || '';
  const qIndex = raw.indexOf('?');
  let search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  if (search) {
    const params = new URLSearchParams(search);
    params.delete('path');
    search = params.toString();
  }
  const qs = search ? `?${search}` : '';
  return `${base}/v1/${tail}${qs}`;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('vary', 'Origin');
}

function forwardHeaders(req) {
  const headers = {};
  for (const key of ['authorization', 'content-type', 'accept', 'accept-language', 'cookie', 'stripe-signature']) {
    const val = req.headers[key];
    if (val) headers[key] = val;
  }
  return headers;
}

async function proxyRequest(req, res) {
  const target = buildTarget(req);
  if (!target) {
    res.statusCode = 503;
    applyCors(req, res);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      error: 'home_offline',
      message: 'Defina HOME_API_URL na Vercel (URL HTTPS do túnel para sua API).',
    }));
    return;
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    applyCors(req, res);
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, Cookie');
    res.end();
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_MS);
  const init = {
    method: req.method,
    headers: { ...forwardHeaders(req), 'accept-encoding': 'identity' },
    redirect: 'manual',
    signal: ctrl.signal,
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    if (init.body && typeof init.body === 'object' && !Buffer.isBuffer(init.body)) {
      init.body = JSON.stringify(init.body);
      if (!init.headers['content-type']) init.headers['content-type'] = 'application/json';
    }
  }
  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (STRIP_FROM_UPSTREAM.has(lower)) return;
      if (lower === 'set-cookie') res.appendHeader('set-cookie', value);
      else res.setHeader(key, value);
    });
    if (!res.getHeader('access-control-allow-origin')) applyCors(req, res);
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length) res.setHeader('content-length', String(body.length));
    res.end(body);
  } catch (err) {
    res.statusCode = 503;
    applyCors(req, res);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      error: 'home_offline',
      message: err?.name === 'AbortError'
        ? 'A API de origem não respondeu a tempo.'
        : 'A API de origem está inacessível.',
    }));
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { upstreamBase, wsOriginFromHome, buildTarget, proxyRequest };
