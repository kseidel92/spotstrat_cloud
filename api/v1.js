const { proxyRequest } = require('../lib/proxy');

module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

module.exports = async (req, res) => {
  try {
    await proxyRequest(req, res);
  } catch (err) {
    console.error('[cloud] proxy', err.message);
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'upstream_fail', message: err.message }));
  }
};
