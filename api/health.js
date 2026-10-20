const { upstreamBase } = require('../lib/proxy');

module.exports = async (req, res) => {
  const base = upstreamBase();
  if (!base) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, home: false }));
    return;
  }
  try {
    const ping = await fetch(`${base}/v1/presets?locale=en`, { method: 'GET' });
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: ping.ok, home: true, upstreamStatus: ping.status }));
  } catch (err) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: false, home: true, error: err.message }));
  }
};
