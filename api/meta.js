const { upstreamBase, wsOriginFromHome } = require('../lib/proxy');

module.exports = async (_req, res) => {
  const home = upstreamBase();
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({
    ok: true,
    homeApiUrl: home || null,
    wsOrigin: wsOriginFromHome(home),
  }));
};
