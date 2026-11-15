import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const serverDir = join(root, 'apps', 'server');
export const mobileDir = join(root, 'apps', 'mobile');
const isWindows = process.platform === 'win32';
const children = new Set();
const cleanups = [];
let stopping = false;

const colors = [36, 35, 33, 32, 34];
let nextColor = 0;

export function flag(name) {
  return process.argv.includes(`--${name}`);
}

export function option(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

export function log(message) {
  console.log(`\x1b[1m›\x1b[0m ${message}`);
}

export function fail(message) {
  console.error(`\x1b[31m✖ ${message}\x1b[0m`);
  stopAll(1);
}

export function npm(args) {
  return process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath, ...args]] : [isWindows ? 'npm.cmd' : 'npm', args];
}

export function expo(args) {
  return [process.execPath, [createRequire(join(mobileDir, 'package.json')).resolve('expo/bin/cli'), ...args]];
}

export function run(command, args, { cwd = root, env } = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', shell: command.endsWith('.cmd') });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed`);
}

export function capture(command, args, { cwd = root } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return result.error || result.status !== 0 ? undefined : result.stdout;
}

export function start(name, command, args, { cwd = root, env, onLine } = {}) {
  const color = colors[nextColor++ % colors.length];
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows
  });
  children.add(child);
  const prefix = `\x1b[${color}m${name.padEnd(7)}│\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        process.stdout.write(prefix + line + '\n');
        onLine?.(stripVTControlCharacters(line));
      }
    });
  }
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      log(`${name} exited${code === null ? '' : ` with code ${code}`}; stopping everything.`);
      stopAll(code ?? 1);
    }
  });
  return child;
}

export function onStop(cleanup) {
  cleanups.push(cleanup);
}

function kill(child) {
  if (child.exitCode !== null || !child.pid) return;
  try {
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}

export function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const cleanup of cleanups.reverse()) {
    try {
      cleanup();
    } catch (error) {
      console.error(error);
    }
  }
  for (const child of children) kill(child);
  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));

export function waitFor(test, { timeoutMs = 120_000, label = 'service' } = {}) {
  const started = Date.now();
  return new Promise((resolvePromise, reject) => {
    const tick = async () => {
      const value = await test().catch(() => undefined);
      if (value) return resolvePromise(value);
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${label}`));
      setTimeout(tick, 1000);
    };
    void tick();
  });
}

export async function healthy(url) {
  const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) }).catch(() => undefined);
  return Boolean(res?.ok);
}

export function serverPort() {
  const fromFlag = option('port');
  if (fromFlag) return Number(fromFlag);
  const envFile = join(serverDir, '.env');
  const match = existsSync(envFile) ? /^\s*PORT\s*=\s*(\d+)/m.exec(readFileSync(envFile, 'utf8')) : null;
  return Number(match?.[1] ?? process.env.PORT ?? 3001);
}

export function ensureServerEnv() {
  if (existsSync(join(serverDir, '.env'))) return;
  log('No apps/server/.env yet. The server will use defaults (fixture routes, no agent).');
  log('Copy apps/server/.env.example to apps/server/.env and fill it in for live routing and the agent.');
}

export function buildServer() {
  log('Building shared packages and the server…');
  run(...npm(['run', 'build:server', '--silent']));
}

export function startServer(port, env = {}) {
  return start('server', process.execPath, ['--env-file-if-exists=.env', 'dist/index.js'], {
    cwd: serverDir,
    env: { PORT: String(port), ...env }
  });
}

const VIRTUAL_ADAPTER = /vethernet|wsl|docker|vmnet|virtualbox|vbox|hyper-v|utun|bridge/i;

export function lanAddresses() {
  const rank = (address) => (address.startsWith('192.168.') ? 0 : address.startsWith('10.') ? 1 : 2);
  return Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL_ADAPTER.test(name))
    .flatMap(([name, nets]) => (nets ?? []).map((net) => ({ ...net, name })))
    .filter((net) => net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.'))
    .map((net) => ({ address: net.address, tailnet: /tailscale/i.test(net.name) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(net.address) }))
    .sort((a, b) => Number(a.tailnet) - Number(b.tailnet) || rank(a.address) - rank(b.address));
}

export function printQr(text) {
  let toQR;
  try {
    ({ toQR } = createRequire(join(mobileDir, 'package.json'))('toqr'));
  } catch {
    return;
  }
  const data = toQR(text);
  const extent = Math.sqrt(data.byteLength) | 0;
  const at = (row, col) => (row < extent && col < extent ? data[row * extent + col] : 0);
  let output = '  ' + '▄'.repeat(extent + 2);
  for (let row = 0; row < extent; row += 2) {
    output += '\n  █';
    for (let col = 0; col < extent; col++) output += [' ', '▄', '▀', '█'][((at(row, col) ? 0 : 1) << 1) | (at(row + 1, col) ? 0 : 1)];
    output += '█';
  }
  if (extent % 2 === 0) output += '\n  ' + '▀'.repeat(extent + 2);
  console.log(output + '\n');
}
