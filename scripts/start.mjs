import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, '.runtime');
const stateFile = join(runtime, 'dev.json');
const help = `Vizora AI startup (Node.js 22.12+ required for all modes)
  dev                 Start container PG/Redis, then local API + Vite (default)
  docker              Start only container PG/Redis and wait for readiness
  check [dev|docker]  Validate prerequisites without starting services
  stop [dev|docker]   Stop owned dev processes or Compose (keep volumes)
  status [dev|docker] Show service status
  logs [dev|docker]   Show recent logs
  help                Show this help

Both modes: copy deploy/.env.example to deploy/.env and configure passwords.
Optional local API overrides: .env.dev (see .env.dev.example).
Visit http://localhost:5173 after dev reports ready. No Nginx or API/Web containers.
Ctrl+C stops local processes only. Use stop docker to stop PG/Redis (keep volumes).
No system software installation, automatic database migration or volume deletion.
`;

export function parseArgs(args) {
  const [action = 'dev', mode = 'dev', ...extra] = args;
  if (!['dev', 'docker', 'check', 'stop', 'status', 'logs', 'help', '--help', '-h'].includes(action)
    || !['dev', 'docker'].includes(mode) || extra.length
    || (['dev', 'docker', 'help', '--help', '-h'].includes(action) && args.length > 1)) {
    throw new Error('Invalid arguments. Run start help.');
  }
  return { action, mode: action === 'docker' ? 'docker' : mode };
}

export function validateDev(env) {
  for (const name of ['ConnectionStrings__Main', 'Auth__SigningKey']) {
    if (!env[name]?.trim() || /REPLACE_WITH/i.test(env[name])) {
      throw new Error(`Set ${name} in deploy/.env, .env.dev or the environment.`);
    }
  }
  if (env.Auth__SigningKey.length < 40) throw new Error('Auth__SigningKey must contain at least 40 characters.');
}

export function validateInfra(env) {
  for (const name of ['POSTGRES_PASSWORD', 'REDIS_PASSWORD']) {
    if (!env[name]?.trim() || /REPLACE_WITH/i.test(env[name])) {
      throw new Error(`Set ${name} in deploy/.env or the environment.`);
    }
  }
  for (const [name, fallback] of [['POSTGRES_PORT', '5432'], ['REDIS_PORT', '6379']]) {
    const value = env[name] ?? fallback;
    if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) {
      throw new Error(`${name} must be an integer from 1 to 65535.`);
    }
  }
  if ((env.POSTGRES_PORT ?? '5432') === (env.REDIS_PORT ?? '6379')) {
    throw new Error('POSTGRES_PORT and REDIS_PORT must be different.');
  }
}

export function buildDevEnv(deployment, local = {}, inherited = process.env) {
  const infra = { ...deployment, ...inherited };
  validateInfra(infra);
  const env = { ...deployment, ...local, ...inherited };
  const password = infra.POSTGRES_PASSWORD.replaceAll('"', '""');
  env.ConnectionStrings__Main = `Host=127.0.0.1;Port=${infra.POSTGRES_PORT ?? '5432'};Database=vizora;Username=vizora;Password="${password}"`;
  validateDev(env);
  delete env.POSTGRES_PASSWORD;
  delete env.REDIS_PASSWORD;
  return {
    ...env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: 'http://127.0.0.1:8080',
    Payments__PublicBaseUrl: 'http://localhost:8080',
    Payments__WebBaseUrl: 'http://localhost:5173',
  };
}

export async function availablePort(port) {
  const server = createTcpServer();
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', accept);
  });
  await new Promise(accept => server.close(accept));
}

export async function waitHttp(url, { timeout = 90000, alive = () => true } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!alive()) throw new Error(`Service exited before readiness: ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch (error) {
      if (!(error instanceof TypeError) && error.name !== 'TimeoutError') throw error;
    }
    await delay(250);
  }
  throw new Error(`Readiness timeout: ${url}. Check logs and database/schema configuration.`);
}

function run(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0
      ? accept() : reject(new Error(`${command} failed (${signal ?? code}).`)));
  });
}

async function output(command, args) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', chunk => { text += chunk; });
    child.stderr.on('data', chunk => { text += chunk; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? accept(text.trim())
      : reject(new Error(`${command} ${args[0]} failed (${code}). Check installation/configuration; for Docker, ensure the engine is running.`)));
  });
}

async function deploymentEnv() {
  const path = join(root, 'deploy/.env');
  if (!existsSync(path)) throw new Error('Missing deploy/.env. Copy deploy/.env.example and configure it first.');
  const deployment = parseEnv(await readFile(path, 'utf8'));
  validateInfra({ ...deployment, ...process.env });
  return deployment;
}

async function devEnv(deployment) {
  const file = join(root, '.env.dev');
  return buildDevEnv(deployment, existsSync(file) ? parseEnv(await readFile(file, 'utf8')) : {});
}

async function preflight(mode) {
  const deployment = await deploymentEnv();
  const env = mode === 'dev' ? await devEnv(deployment) : undefined;
  await output('docker', ['compose', 'version']);
  await output('docker', ['info', '--format', '{{.ServerVersion}}']);
  await output('docker', composeArgs(['config', '--quiet']));
  if (mode === 'docker') return;
  const sdks = await output('dotnet', ['--list-sdks']);
  if (!/^10\./m.test(sdks)) throw new Error('.NET SDK 10 is required.');
  if (!existsSync(join(root, 'web/node_modules/vite/bin/vite.js'))) {
    throw new Error('Missing frontend dependencies. Run: npm ci --prefix web');
  }
  await availablePort(8080);
  await availablePort(5173);
  return env;
}

function composeArgs(args) {
  return ['compose', '--project-directory', join(root, 'deploy'), '-f', join(root, 'deploy/compose.yml'),
    '--env-file', join(root, 'deploy/.env'), ...args];
}

async function readState() {
  try {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    if (!Number.isInteger(state.port) || state.port < 1 || state.port > 65535
      || !/^[a-f0-9]{64}$/.test(state.token)) throw new Error('Invalid dev state. Inspect .runtime/dev.json.');
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function control(state, method = 'GET') {
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/`, {
      method, headers: { Authorization: `Bearer ${state.token}` },
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json();
    if (!response.ok || body.service !== 'vizora-dev') throw new Error('Unexpected dev controller response.');
    return body;
  } catch (error) {
    if (error instanceof TypeError && error.cause?.code === 'ECONNREFUSED') return null;
    throw error;
  }
}

async function startDev(env) {
  await mkdir(runtime, { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('hex');
  const children = [];
  const streams = [];
  let stopping = false;
  let ready = false;
  let finish;
  const finished = new Promise(accept => { finish = accept; });
  const controller = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(403).end();
      return;
    }
    if (!['GET', 'POST'].includes(request.method) || request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ service: 'vizora-dev', ready, pid: process.pid }));
    if (request.method === 'POST') void shutdown(0);
  });
  async function shutdown(code) {
    if (stopping) return;
    stopping = true;
    ready = false;
    process.exitCode = code;
    for (const child of children) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      child.kill('SIGTERM');
    }
    for (const child of children) {
      for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await delay(100);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await new Promise(accept => controller.close(accept));
    for (const stream of streams) await new Promise(accept => stream.end(accept));
    await rm(stateFile, { force: true });
    await rm(join(runtime, 'dev.lock'), { force: true });
    finish();
  }
  function launch(name, command, args, cwd, oneShot = false, childEnv = env) {
    const log = createWriteStream(join(runtime, `${name}.log`), { flags: 'w', mode: 0o600 });
    streams.push(log);
    log.on('error', error => {
      console.error(`${name} log failed: ${error.message}`);
      void shutdown(1);
    });
    const child = spawn(command, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    for (const source of [child.stdout, child.stderr]) source.on('data', chunk => {
      log.write(chunk);
      process.stdout.write(`[${name}] ${chunk}`);
    });
    child.once('error', error => {
      console.error(`${name} failed: ${error.message}`);
      void shutdown(1);
    });
    child.once('exit', (code, signal) => {
      if (!stopping && !oneShot) {
        console.error(`${name} exited unexpectedly (${signal ?? code}).`);
        void shutdown(1);
      }
    });
    return child;
  }
  async function launchOnce(name, command, args, cwd, childEnv = env) {
    const child = launch(name, command, args, cwd, true, childEnv);
    const code = await new Promise(accept => {
      child.once('exit', accept);
      child.once('error', () => accept(-1));
    });
    if (!stopping && code !== 0) throw new Error(`${name} failed (${code}). Check .runtime/${name}.log.`);
  }
  try {
    await writeFile(join(runtime, 'dev.lock'), String(process.pid), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Dev lock exists. Run status; after a crash, verify the recorded process has stopped before removing .runtime/dev.lock.');
    throw error;
  }
  process.once('SIGINT', () => void shutdown(0));
  process.once('SIGTERM', () => void shutdown(0));
  try {
    await new Promise((accept, reject) => {
      controller.once('error', reject);
      controller.listen(0, '127.0.0.1', accept);
    });
    await writeFile(stateFile, JSON.stringify({ port: controller.address().port, token }), { mode: 0o600 });
    await chmod(stateFile, 0o600);
    // Compose receives only deployment/process settings, not local API overrides.
    await launchOnce('infra', 'docker', composeArgs(['up', '-d', '--wait', '--wait-timeout', '180', 'postgres', 'redis']), root, process.env);
    if (stopping) return await finished;
    await launchOnce('build', 'dotnet', ['build', 'Vizora.Api.csproj', '-c', 'Debug', '-o', join(runtime, 'api')], join(root, 'api'));
    if (stopping) return await finished;
    launch('api', 'dotnet', [join(runtime, 'api/Vizora.Api.dll')], join(root, 'api'));
    await waitHttp('http://127.0.0.1:8080/api/health', { alive: () => !stopping });
    if (stopping) return await finished;
    launch('web', process.execPath, [join(root, 'web/node_modules/vite/bin/vite.js'),
      '--host', '127.0.0.1', '--port', '5173', '--strictPort'], join(root, 'web'));
    await waitHttp('http://127.0.0.1:5173', { alive: () => !stopping });
    if (!stopping) {
      ready = true;
      console.log('\nReady: http://localhost:5173\nAPI: http://127.0.0.1:8080/api/health\nCtrl+C or start stop dev to stop.');
    }
    await finished;
  } catch (error) {
    if (stopping) {
      await finished;
    } else {
      console.error(`Startup failed: ${error.message}`);
      await shutdown(1);
    }
  }
}

export async function main(args = process.argv.slice(2)) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js 22.12+ is required.');
  const { action, mode } = parseArgs(args);
  if (['help', '--help', '-h'].includes(action)) return console.log(help);
  if (action === 'check') {
    await preflight(mode);
    return console.log(`${mode} prerequisites OK (not an external-service acceptance test).`);
  }
  if (mode === 'docker') {
    if (action === 'docker') {
      await preflight(mode);
      await run('docker', composeArgs(['up', '-d', '--wait', '--wait-timeout', '180', 'postgres', 'redis']));
      return console.log('PostgreSQL and Redis healthy. API/Web are not containerized. Run start dev for local API/Web.');
    }
    const commands = { stop: ['stop', 'postgres', 'redis'], status: ['ps', '-a'], logs: ['logs', '--tail', '80', 'postgres', 'redis'] };
    return run('docker', composeArgs(commands[action]));
  }
  if (action === 'logs') {
    for (const name of ['infra', 'build', 'api', 'web']) {
      const path = join(runtime, `${name}.log`);
      console.log(`--- ${name} ---`);
      console.log(existsSync(path) ? (await readFile(path, 'utf8')).split('\n').slice(-80).join('\n') : 'No log yet.');
    }
    return;
  }
  const state = await readState();
  const current = state ? await control(state) : null;
  if (action === 'status') {
    console.log(current ? `Dev ${current.ready ? 'ready' : 'starting'} (PID ${current.pid}).` : 'Dev stopped (no responsive owned controller).');
    if (!current) process.exitCode = 1;
    return;
  }
  if (action === 'stop') {
    if (!current) return console.log('Dev already stopped. No unrelated processes were terminated.');
    await control(state, 'POST');
    for (let i = 0; i < 150; i++) {
      if (!existsSync(stateFile)) return console.log('Dev stopped.');
      await delay(100);
    }
    throw new Error('Dev stop timed out. Inspect logs; no unrelated processes were terminated.');
  }
  if (current) throw new Error('Dev already running. Use start status dev or start stop dev.');
  await startDev(await preflight('dev'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
