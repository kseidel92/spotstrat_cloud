const http = require('http');
const { proxyRequest } = require('./lib/proxy');

const port = Number(process.env.PORT) || 8787;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/health') {
    req.query = {};
    return require('./api/health')(req, res);
  }
  const prefix = '/v1/';
  if (!url.pathname.startsWith(prefix)) {
    res.statusCode = 404;
    return res.end('not found');
  }
  const tail = url.pathname.slice(prefix.length);
  req.query = { path: tail.split('/').filter(Boolean) };
  req.url = url.pathname.slice(prefix.length - 1) + url.search;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  req.body = Buffer.concat(chunks).length ? Buffer.concat(chunks) : undefined;
  return proxyRequest(req, res);
});

server.listen(port, () => {
  console.log(`[cloud] relay http://127.0.0.1:${port}/v1/ → ${process.env.HOME_API_URL || '(HOME_API_URL)'}`);
});
