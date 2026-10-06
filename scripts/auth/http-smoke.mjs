/** Local production-build smoke test. Starts ONLY loopback fixtures; never uses operating credentials. */
import https from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'reelstamp-http-auth-'));
const key = join(temporary, 'key.pem'), cert = join(temporary, 'cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
  '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
let mode = 'ok', refreshCalls = 0, authHeader = '';
const end = new Date(Date.now() + 86400000).toISOString();
const token = `x.${Buffer.from(JSON.stringify({ type: 'ACCESS', sid: 'session-one', exp: Date.now()/1000+3600 })).toString('base64url')}.fixture`;
const tokenInfo = { accessToken: token, refreshToken: 'fixture-successor', tokenType: 'Bearer', expiresIn: 3600,
  sessionId: 'session-one', accessTokenExpiresAt: new Date(Date.now()+3600000).toISOString(), refreshTokenExpiresAt: end };
const user = { id: 1, userId: 1, provider: 'GOOGLE', guest: false, role: 'USER', nickname: '로컬 테스트' };
const backend = https.createServer({ key: await readFile(key), cert: await readFile(cert) }, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/auth/token/refresh') {
    refreshCalls++;
    if (mode !== 'ok') { res.statusCode = mode === 'invalid' ? 401 : 503; res.end(JSON.stringify({ success: false })); return; }
    res.end(JSON.stringify({ success: true, data: tokenInfo })); return;
  }
  authHeader = req.headers.authorization;
  if (mode === 'offline') { res.statusCode = 503; res.end('{}'); return; }
  const data = req.url === '/api/user/me' ? user : req.url === '/api/auth/session'
    ? { userInfo: user, sessionId: 'session-one', refreshTokenExpiresAt: end } : [];
  res.end(JSON.stringify({ success: true, data }));
});
await new Promise(resolve => backend.listen(18443, '127.0.0.1', resolve));
const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '13100', '-H', '127.0.0.1'], {
  env: { ...process.env, WEB_API_BASE_URL: 'https://127.0.0.1:18443', NODE_EXTRA_CA_CERTS: cert }, stdio: ['ignore', 'pipe', 'pipe'],
});
web.stdout.resume(); web.stderr.resume();
const base = 'http://127.0.0.1:13100';
const request = (path, options = {}) => fetch(base+path, { ...options, redirect: 'manual', headers: { cookie: 'refreshToken=fixture-original', ...options.headers } });
try {
  for (let i=0;i<80;i++) {
    try { await fetch(base+'/favicon.ico'); break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  let response = await request('/auth/complete');
  assert.equal(response.status,200);
  assert.match(await response.text(), /로그인을 완료했어요/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /Secure/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=lax/i);
  assert.equal(authHeader, 'Bearer '+token); // Fresh request cookies reached SSR, not only the browser.
  response = await request('/api/auth/session');
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'), /fixture-successor/);
  mode='offline';refreshCalls=0;
  response=await request('/auth/complete');assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.equal(refreshCalls,2);
  mode='invalid';refreshCalls=0;
  response=await request('/auth/complete');assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/1970/);assert.equal(refreshCalls,1);
  mode='ok';
  response=await request('/api/auth/logout-all',{method:'POST',headers:{origin:'https://evil.test'}});assert.equal(response.status,403);
  response=await request('/api/auth/logout-all',{method:'POST',headers:{origin:base}});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/1970/);
  mode='offline';
  response=await request('/api/auth/logout-all',{method:'POST',headers:{origin:base}});assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);
  console.log('PASS: production SSR cookie forwarding, mutable API refresh, outage preservation, retry limit, invalidation, CSRF and confirmed logout');
} catch(error) {
  // Do not print HTTP credentials or arbitrary server logs.
  console.error('Local auth smoke failed:',error.stack);process.exitCode=1;
} finally {
  web.kill('SIGTERM');backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}
