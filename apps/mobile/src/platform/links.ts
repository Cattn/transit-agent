// Pure: no react-native / expo imports, so Vitest can load it. The Expo hook is links-native.ts.

/** app.json "scheme". The EAS dev client also registers `exp+transit-agent`. */
export const APP_SCHEME = 'transit-agent';
const ACCEPTED_SCHEMES = new Set([APP_SCHEME, `exp+${APP_SCHEME}`]);

/** `transit-agent://trip/<id>`, with the id URL-encoded (so "/" and spaces survive). */
export function tripLink(id: string): string {
  return `${APP_SCHEME}://trip/${encodeURIComponent(id)}`;
}

/**
 * The saved-trip id from a `transit-agent://trip/<id>` (or dev-client `exp+transit-agent://trip/<id>`)
 * link, or null for anything else. Ignores any ?query or #fragment.
 */
export function parseTripLink(url: string): { tripId: string } | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\/\/?trip\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  if (!match || !ACCEPTED_SCHEMES.has(match[1]!.toLowerCase())) return null;
  try {
    const tripId = decodeURIComponent(match[2]!);
    return tripId ? { tripId } : null;
  } catch {
    return null; // malformed %-encoding
  }
}
