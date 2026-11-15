import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

const DEFAULT_APK_URL = 'https://github.com/Cattn/transit-agent/releases/latest/download/transit-agent.apk';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function baseUrl(request: FastifyRequest): string {
  const configured = process.env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = String(request.headers['x-forwarded-proto'] ?? request.protocol).split(',')[0]?.trim() || 'http';
  const host = String(request.headers['x-forwarded-host'] ?? request.host).split(',')[0]?.trim();
  return `${proto}://${host}`;
}

export function connectPage(server: string, apkUrl: string, expoGoUrl?: string): string {
  const appLink = `transit-agent://connect?url=${encodeURIComponent(server)}`;
  const expoLink = expoGoUrl ? `${expoGoUrl.replace(/\/+$/, '')}/--/connect?url=${encodeURIComponent(server)}` : undefined;
  const button = (href: string, label: string, note: string) =>
    `<a class="button" href="${escapeHtml(href)}">${escapeHtml(label)}</a><p class="note">${escapeHtml(note)}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transit Agent test server</title>
<style>
:root { color-scheme: light dark; --bg: #fdf8fd; --fg: #1b1b1f; --muted: #46464f; --primary: #3f51b5; --on-primary: #fff; --card: #f2eff4; }
@media (prefers-color-scheme: dark) { :root { --bg: #131316; --fg: #e4e1e6; --muted: #c6c5d0; --primary: #bac3ff; --on-primary: #08218a; --card: #1f1f23; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 480px; margin: 0 auto; padding: 32px 16px; }
h1 { font-size: 24px; margin: 0 0 4px; }
.button { display: block; margin-top: 20px; padding: 14px 20px; border-radius: 999px; background: var(--primary); color: var(--on-primary); text-align: center; text-decoration: none; font-weight: 600; }
.note, .muted { color: var(--muted); font-size: 14px; margin: 6px 4px 0; }
code { display: block; margin-top: 8px; padding: 12px; border-radius: 12px; background: var(--card); overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
<h1>Transit Agent</h1>
<p class="muted">Test server: this page is served by the laptop running the API.</p>
${button(apkUrl, '1. Install the Android app', 'Downloads the latest APK from GitHub releases. Allow installs from your browser if Android asks.')}
${button(appLink, '2. Connect the app to this server', 'Opens Transit Agent and saves this server. You only need to do this once.')}
${expoLink ? button(expoLink, 'Or open in Expo Go', 'Runs the live development build. Needs the Expo Go app.') : ''}
<p class="muted" style="margin-top:24px">Server address, if you need to type it:</p>
<code>${escapeHtml(server)}</code>
</main>
</body>
</html>
`;
}

export const connectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/connect', async (request, reply) => {
    reply.type('text/html; charset=utf-8');
    return connectPage(baseUrl(request), process.env.APK_URL?.trim() || DEFAULT_APK_URL, process.env.EXPO_GO_URL?.trim() || undefined);
  });
};
