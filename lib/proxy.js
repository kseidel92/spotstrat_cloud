const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

function upstreamBase() {
  return (process.env.HOME_API_URL || '').replace(/\/$/, '');
}

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

function forwardHeaders(req) {
  const headers = {};
  for (const key of ['authorization', 'content-type', 'accept', 'accept-language', 'cookie']) {
    const val = req.headers[key];
    if (val) headers[key] = val;
  }
  return headers;
}

async function proxyRequest(req, res) {
  const target = buildTarget(req);
  if (!target) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      error: 'home_offline',
      message: 'Defina HOME_API_URL na Vercel (URL HTTPS do túnel para sua API).',
    }));
    return;
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', req.headers.origin || '*');
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, Cookie');
    res.end();
    return;
  }
  const init = { method: req.method, headers: forwardHeaders(req), redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    if (init.body && typeof init.body === 'object' && !Buffer.isBuffer(init.body)) {
      init.body = JSON.stringify(init.body);
      if (!init.headers['content-type']) init.headers['content-type'] = 'application/json';
    }
  }
  const upstream = await fetch(target, init);
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', value);
    else res.setHeader(key, value);
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  res.end(body);
}

module.exports = { upstreamBase, buildTarget, proxyRequest };
