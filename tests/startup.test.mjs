import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { availablePort, buildDevEnv, parseArgs, validateDev, validateInfra, waitHttp } from '../scripts/start.mjs';

const deployment = {
  POSTGRES_PASSWORD: 'database-secret',
  REDIS_PASSWORD: 'redis-secret',
  Auth__SigningKey: 'x'.repeat(40),
};

test('managed infrastructure supplies the local API connection without exposing secrets', () => {
  const env = buildDevEnv(deployment, { Mail__Host: 'smtp.local' }, {});
  assert.equal(env.ConnectionStrings__Main, 'Host=127.0.0.1;Port=5432;Database=vizora;Username=vizora;Password="database-secret"');
  assert.equal(env.Mail__Host, 'smtp.local');
  assert.equal(env.Auth__SigningKey, deployment.Auth__SigningKey);
  assert.equal(env.ASPNETCORE_ENVIRONMENT, 'Development');
  assert.equal(env.Payments__WebBaseUrl, 'http://localhost:5173');
  assert.equal(env.Payments__PublicBaseUrl, 'http://localhost:8080');
  assert.equal(env.REDIS_PASSWORD, undefined, 'Unused infrastructure secrets should not be passed to local apps');
  assert.equal(env.POSTGRES_PASSWORD, undefined);
});

test('process environment overrides optional app settings and managed ports/passwords', () => {
  const env = buildDevEnv(deployment, { Mail__Host: 'local-file' }, {
    POSTGRES_PORT: '55432', REDIS_PORT: '56379', POSTGRES_PASSWORD: 'a;"quoted"',
    Mail__Host: 'process-host', DOTNET_ENVIRONMENT: 'Production',
    ConnectionStrings__Main: 'Host=unrelated',
  });
  assert.equal(env.ConnectionStrings__Main, 'Host=127.0.0.1;Port=55432;Database=vizora;Username=vizora;Password="a;""quoted"""');
  assert.equal(env.Mail__Host, 'process-host');
  assert.equal(env.DOTNET_ENVIRONMENT, 'Development');
});

test('container-only validation requires both passwords but not application signing keys', () => {
  assert.doesNotThrow(() => validateInfra({ POSTGRES_PASSWORD: 'db', REDIS_PASSWORD: 'cache' }));
  for (const key of ['POSTGRES_PASSWORD', 'REDIS_PASSWORD']) {
    assert.throws(() => validateInfra({ ...deployment, [key]: '' }), new RegExp(key));
    assert.throws(() => validateInfra({ ...deployment, [key]: 'REPLACE_WITH_SECRET' }), new RegExp(key));
  }
  for (const value of ['0', '65536', 'abc', '5432:5432']) {
    assert.throws(() => validateInfra({ ...deployment, POSTGRES_PORT: value }), /POSTGRES_PORT/);
  }
  assert.throws(() => validateInfra({ ...deployment, POSTGRES_PORT: '6379' }), /different/);
});

test('Compose only deploys persistent loopback PostgreSQL and authenticated Redis', () => {
  const compose = readFileSync(new URL('../deploy/compose.yml', import.meta.url), 'utf8');
  const services = compose.split('\nvolumes:')[0].match(/^  [a-z]+:/gm);
  assert.deepEqual(services, ['  postgres:', '  redis:']);
  assert.match(compose, /127\.0\.0\.1:\$\{POSTGRES_PORT:-5432\}:5432/);
  assert.match(compose, /127\.0\.0\.1:\$\{REDIS_PORT:-6379\}:6379/);
  assert.match(compose, /pgdata:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /redisdata:\/data/);
  assert.match(compose, /--appendonly/);
  assert.match(compose, /--requirepass/);
  assert.match(compose, /REDISCLI_AUTH/);
  assert.doesNotMatch(compose, /nginx|build:|8088/);
  assert.equal(existsSync(new URL('../web/nginx.conf', import.meta.url)), false);
  assert.equal(existsSync(new URL('../web/Dockerfile', import.meta.url)), false);
});

test('default and explicit startup modes', () => {
  assert.deepEqual(parseArgs([]), { action: 'dev', mode: 'dev' });
  assert.deepEqual(parseArgs(['docker']), { action: 'docker', mode: 'docker' });
  for (const action of ['check', 'stop', 'status', 'logs']) {
    for (const mode of ['dev', 'docker']) assert.deepEqual(parseArgs([action, mode]), { action, mode });
  }
});

test('invalid operations fail rather than guessing', () => {
  for (const args of [['delete'], ['stop', 'prod'], ['dev', 'docker'], ['check', 'dev', 'extra'], ['--help', 'dev']]) {
    assert.throws(() => parseArgs(args), /Invalid arguments/);
  }
});

test('requires real connection and signing key without exposing values', () => {
  assert.throws(() => validateDev({}), /ConnectionStrings__Main/);
  assert.throws(() => validateDev({ ConnectionStrings__Main: 'Password=REPLACE_WITH_DB_PASSWORD' }), /ConnectionStrings__Main/);
  assert.throws(() => validateDev({ ConnectionStrings__Main: 'private', Auth__SigningKey: 'short' }), /at least 40/);
  assert.throws(() => validateDev({ ConnectionStrings__Main: 'private', Auth__SigningKey: 'REPLACE_WITH_' + 'x'.repeat(40) }), /Auth__SigningKey/);
  assert.doesNotThrow(() => validateDev({ ConnectionStrings__Main: 'private', Auth__SigningKey: 'x'.repeat(40) }));
});

test('busy port is detected without terminating its owner', async () => {
  const server = createServer((request, response) => response.end('ok'));
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  const port = server.address().port;
  try {
    await assert.rejects(availablePort(port), { code: 'EADDRINUSE' });
    await waitHttp(`http://127.0.0.1:${port}`);
    assert.equal(server.listening, true);
  } finally {
    await new Promise(accept => server.close(accept));
  }
  await availablePort(port);
});

test('readiness retries unhealthy HTTP and then accepts success', async () => {
  let requests = 0;
  const server = createServer((request, response) => {
    response.statusCode = ++requests < 2 ? 503 : 200;
    response.end();
  });
  await new Promise(accept => server.listen(0, '127.0.0.1', accept));
  try {
    await waitHttp(`http://127.0.0.1:${server.address().port}`, { timeout: 2000 });
    assert.equal(requests, 2);
  } finally {
    await new Promise(accept => server.close(accept));
  }
});

test('readiness timeout and early service exit are failures', async () => {
  await assert.rejects(waitHttp('http://127.0.0.1:1', { timeout: 50 }), /Readiness timeout/);
  await assert.rejects(waitHttp('http://127.0.0.1:1', { alive: () => false }), /Service exited/);
});

test('CLI help and argument errors work from an unrelated working directory', () => {
  const script = fileURLToPath(new URL('../scripts/start.mjs', import.meta.url));
  const help = spawnSync(process.execPath, [script, 'help'], { cwd: tmpdir(), encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /check \[dev\|docker\]/);
  const invalid = spawnSync(process.execPath, [script, 'wipe'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid arguments/);
});
