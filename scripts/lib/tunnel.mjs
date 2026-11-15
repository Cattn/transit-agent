import { capture, fail, log, start } from './processes.mjs';

function installed(command, versionArg) {
  return capture(command, [versionArg]) !== undefined;
}

export function openTunnel(port) {
  const wanted = process.argv.find((arg) => arg.startsWith('--tunnel='))?.slice('--tunnel='.length);
  const kind = wanted ?? (installed('tailscale', 'version') ? 'tailscale' : installed('cloudflared', '--version') ? 'cloudflared' : undefined);
  if (!kind) fail('--public needs Tailscale (https://tailscale.com/download) or cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).');

  log(kind === 'tailscale'
    ? `Opening a Tailscale Funnel to port ${port}. If Tailscale asks you to enable Funnel, open the link it prints.`
    : `Opening a Cloudflare quick tunnel to port ${port}.`);

  return new Promise((resolve) => {
    const pattern = kind === 'tailscale' ? /https:\/\/[a-z0-9.-]+\.ts\.net/i : /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
    const onLine = (line) => {
      const url = pattern.exec(line)?.[0];
      if (url) resolve(url);
    };
    if (kind === 'tailscale') start('funnel', 'tailscale', ['funnel', String(port)], { onLine });
    else start('tunnel', 'cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { onLine });
  });
}
