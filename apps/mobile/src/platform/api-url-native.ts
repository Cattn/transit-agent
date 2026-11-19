// Expo wrapper around the pure resolveApiUrl (api-url.ts). Plain .ts on purpose: with a
// `.native.ts` name, Metro would resolve this file's own `./api-url` import back to itself.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiUrl, savedServerUrl } from './api-url';

/** The API base URL for this device: saved server → env override → Expo LAN host → emulator/simulator default. */
export function getApiUrl(storedUrl?: string | null): string {
  return resolveApiUrl({
    storedUrl,
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri,
    os: Platform.OS
  });
}

/** The address Default reaches, in saved-server form, or null when Default is sample data (mock builds). */
export function defaultServerUrl(): string | null {
  if (process.env.EXPO_PUBLIC_API_MODE !== 'server') return null;
  const url = getApiUrl(null);
  return savedServerUrl(url) ?? url;
}
