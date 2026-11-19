// Phone-only plumbing every screen needs (plan 018). Pure helpers are unit-tested; the rest wrap Expo modules.
export { DEFAULT_API_PORT, normalizeServerUrl, parseConnectLink, resolveApiUrl, type ResolveApiUrlInput } from './api-url';
export { defaultServerUrl, getApiUrl } from './api-url-native';
export { DEVICE_ID_KEY, secureStoreDeviceIdStorage, type DeviceIdStorage } from './device-id-storage';
export { SERVER_URL_KEY, onServerUrl, removeServer, setServerUrl, useSavedServers, useServerUrl } from './server-url';
export { currentLocationPlace, getCurrentPlace, getLastKnownLocation, type LocationResult } from './location';
export { useAppForeground } from './use-app-foreground';
