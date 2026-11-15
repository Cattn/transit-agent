import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildServer, expo, capture, ensureServerEnv, fail, flag, healthy, log, mobileDir, onStop, option, run, serverPort, start, startServer, waitFor } from './lib/processes.mjs';

const APK_URL = process.env.APK_URL || 'https://github.com/Cattn/transit-agent/releases/latest/download/transit-agent.apk';
const EXPO_GO = 'host.exp.exponent';
const APP = 'com.transitagent.app';

function findAdb() {
  if (capture('adb', ['version'])) return 'adb';
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  const candidate = sdk && join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (candidate && existsSync(candidate)) return candidate;
  fail('adb not found. Install Android platform-tools (winget install Google.PlatformTools) and connect the phone with USB debugging on.');
}

const adbPath = findAdb();
const serial = option('serial');
const adbArgs = (args) => (serial ? ['-s', serial, ...args] : args);
const adb = (...args) => run(adbPath, adbArgs(args));
const adbOut = (...args) => capture(adbPath, adbArgs(args)) ?? '';

const devices = adbOut('devices').split(/\r?\n/).slice(1).filter((line) => /\tdevice$/.test(line)).map((line) => line.split('\t')[0]);
if (devices.length === 0) fail('No Android phone found. Plug it in, turn on USB debugging, and accept the prompt on the phone.');
if (devices.length > 1 && !serial) fail(`More than one device: ${devices.join(', ')}. Pass --serial=<id>.`);

const mock = flag('mock');
const useApp = flag('app') || flag('install');
const port = serverPort();
const metroPort = Number(option('metro-port', '8081'));
const apiUrl = `http://127.0.0.1:${port}`;
if (mock && useApp) fail('--app and --install use the real server; drop --mock.');

if (flag('install')) {
  log(`Downloading the latest APK from ${APK_URL}…`);
  const res = await fetch(APK_URL);
  if (!res.ok) fail(`Download failed (${res.status}). Is there a GitHub release with transit-agent.apk yet?`);
  const file = join(mkdtempSync(join(tmpdir(), 'transit-apk-')), 'transit-agent.apk');
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  log('Installing on the phone…');
  adb('install', '-r', file);
}

const installedPackages = adbOut('shell', 'pm', 'list', 'packages');

if (!mock) {
  if (await healthy(apiUrl)) {
    log(`Using the server already running on port ${port}.`);
  } else if (flag('no-server')) {
    fail(`No server on port ${port}. Start one (npm run host) or drop --no-server.`);
  } else {
    ensureServerEnv();
    buildServer();
    startServer(port);
    await waitFor(() => healthy(apiUrl), { label: 'the server' }).catch((error) => fail(error.message));
  }
  adb('reverse', `tcp:${port}`, `tcp:${port}`);
  onStop(() => capture(adbPath, adbArgs(['reverse', '--remove', `tcp:${port}`])));
}

if (useApp) {
  if (!installedPackages.includes(`package:${APP}`)) fail('Transit Agent is not installed. Run npm run phone:apk to install the latest release.');
  log('Connecting the installed app to the server over USB…');
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `"transit-agent://connect?url=${encodeURIComponent(apiUrl)}"`, APP);
  log('\x1b[32mDone.\x1b[0m The app now uses this laptop over USB. Press Ctrl+C to stop the server.');
} else {
  if (!installedPackages.includes(`package:${EXPO_GO}`)) fail('Expo Go is not installed on the phone. Install it from the Play Store, then run this again.');
  adb('reverse', `tcp:${metroPort}`, `tcp:${metroPort}`);
  onStop(() => capture(adbPath, adbArgs(['reverse', '--remove', `tcp:${metroPort}`])));
  log(`Starting Metro on port ${metroPort} (${mock ? 'mock data' : `server at ${apiUrl}`})…`);
  start('metro', ...expo(['start', '--go', '--localhost', '--port', String(metroPort)]), {
    cwd: mobileDir,
    env: mock ? { EXPO_PUBLIC_API_MODE: 'mock' } : { EXPO_PUBLIC_API_MODE: 'server', EXPO_PUBLIC_API_URL: apiUrl }
  });
  await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${metroPort}/status`, { signal: AbortSignal.timeout(2000) });
    return (await res.text()).includes('running');
  }, { label: 'Metro' }).catch((error) => fail(error.message));
  log('Opening Expo Go on the phone…');
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `"exp://127.0.0.1:${metroPort}/--/connect?url=${mock ? '' : encodeURIComponent(apiUrl)}"`, EXPO_GO);
  log('\x1b[32mRunning.\x1b[0m Edits reload on the phone. Press Ctrl+C to stop.');
}
