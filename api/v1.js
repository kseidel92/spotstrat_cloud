const { proxyRequest } = require('../lib/proxy');

module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

module.exports = async (req, res) => {
  try {
    await proxyRequest(req, res);
  } catch (err) {
    console.error('[cloud] proxy', err.message);
    if (res.headersSent) return;
    res.statusCode = 502;
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('vary', 'Origin');
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'upstream_fail', message: err.message }));
  }
};
