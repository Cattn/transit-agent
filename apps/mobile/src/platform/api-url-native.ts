// Expo wrapper around the pure resolveApiUrl (api-url.ts). Plain .ts on purpose: with a
// `.native.ts` name, Metro would resolve this file's own `./api-url` import back to itself.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiUrl } from './api-url';

/** The API base URL for this device: env override → Expo LAN host → emulator/simulator default. */
export function getApiUrl(): string {
  return resolveApiUrl({
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    hostUri: Constants.expoConfig?.hostUri,
    os: Platform.OS
  });
}
