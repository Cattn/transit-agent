/**
 * Create a new anonymous device id (decision D4). Sent as the `x-device-id` header via
 * `createApiClient(baseUrl, { deviceId })`.
 *
 * Uses `crypto.randomUUID()` (browsers, Node, Hermes/Expo). If it is unavailable at runtime,
 * falls back to a 32-character hex string from `Math.random`.
 *
 * This function only creates the id. **Storage stays in each app**: create it once, persist it,
 * and reuse it on later launches (web: `localStorage`; mobile: `expo-secure-store` or AsyncStorage).
 */
export function createDeviceId(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  let hex = '';
  for (let i = 0; i < 32; i += 1) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}
