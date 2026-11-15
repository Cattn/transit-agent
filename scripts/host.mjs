import { buildServer, expo, ensureServerEnv, fail, flag, healthy, lanAddresses, log, mobileDir, option, printQr, serverPort, start, startServer, waitFor } from './lib/processes.mjs';
import { openTunnel } from './lib/tunnel.mjs';

const port = serverPort();
const isPublic = flag('public');
const withExpo = flag('expo');
const lan = lanAddresses();

if (await healthy(`http://127.0.0.1:${port}`)) fail(`Something is already serving on port ${port}. Stop it first, or pass --port=<other>.`);

ensureServerEnv();
if (!flag('no-build')) buildServer();

const publicUrl = isPublic ? await openTunnel(port) : undefined;
const serverUrl = publicUrl ?? (lan[0] ? `http://${lan[0].address}:${port}` : `http://localhost:${port}`);

let expoGoUrl;
if (withExpo) {
  log(`Starting Metro for Expo Go (${isPublic ? 'Expo tunnel' : 'same Wi-Fi'})…`);
  expoGoUrl = await new Promise((resolve) => {
    start('metro', ...expo(['start', '--go', isPublic ? '--tunnel' : '--lan', '--port', option('metro-port', '8081')]), {
      cwd: mobileDir,
      env: { EXPO_PUBLIC_API_MODE: 'server', EXPO_PUBLIC_API_URL: serverUrl },
      onLine: (line) => {
        const url = /exp:\/\/[^\s'"]+/.exec(line)?.[0];
        if (url) resolve(url);
      }
    });
  });
}

startServer(port, {
  ...(publicUrl ? { PUBLIC_URL: publicUrl } : {}),
  ...(expoGoUrl ? { EXPO_GO_URL: expoGoUrl } : {})
});
await waitFor(() => healthy(`http://127.0.0.1:${port}`), { label: 'the server' }).catch((error) => fail(error.message));

console.log('');
log('\x1b[32mServer is up.\x1b[0m Press Ctrl+C to stop everything.');
console.log(`    This laptop:  http://localhost:${port}`);
for (const { address, tailnet } of lan) console.log(`    ${tailnet ? 'Tailnet:  ' : 'Same Wi-Fi:'}   http://${address}:${port}`);
if (publicUrl) console.log(`    Internet:     ${publicUrl}`);
if (expoGoUrl) console.log(`    Expo Go:      ${expoGoUrl}`);
console.log('');
log(`Testers open this on their phone (or scan it): \x1b[1m${serverUrl}/connect\x1b[0m`);
log('It links the Android APK and connects the app to this server in one tap.');
if (!publicUrl) log('Only phones on the same Wi-Fi can reach it. Use npm run host:public for anyone, anywhere.');
console.log('');
printQr(`${serverUrl}/connect`);
