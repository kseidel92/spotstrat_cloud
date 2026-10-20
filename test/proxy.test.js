const test = require('node:test');
const assert = require('node:assert');
const { buildTarget } = require('../lib/proxy');

test('buildTarget joins path and query', () => {
  process.env.HOME_API_URL = 'https://home.example.com';
  const target = buildTarget({
    query: { path: ['auth', 'login'] },
    url: '/api/v1/auth/login?foo=1',
  });
  assert.equal(target, 'https://home.example.com/v1/auth/login?foo=1');
});

test('buildTarget without HOME_API_URL', () => {
  delete process.env.HOME_API_URL;
  assert.equal(buildTarget({ query: { path: ['ping'] }, url: '' }), null);
});
