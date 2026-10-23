const { upstreamBase, wsOriginFromHome } = require('../lib/proxy');

module.exports = async (req, res) => {
  const base = upstreamBase();
  const meta = { homeApiUrl: base || null, wsOrigin: wsOriginFromHome(base) };
  if (!base) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, home: false, ...meta }));
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const ping = await fetch(`${base}/v1/health`, { method: 'GET', signal: ctrl.signal });
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: ping.ok, home: true, upstreamStatus: ping.status, ...meta }));
  } catch (err) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      home: true,
      error: err?.name === 'AbortError' ? 'timeout' : err.message,
      ...meta,
    }));
  } finally {
    clearTimeout(timer);
  }
};
