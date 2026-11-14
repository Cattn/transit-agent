// Phone-only plumbing every screen needs (plan 018). Pure helpers are unit-tested; the rest wrap Expo modules.
export { DEFAULT_API_PORT, resolveApiUrl, type ResolveApiUrlInput } from './api-url';
export { getApiUrl } from './api-url-native';
export { DEVICE_ID_KEY, secureStoreDeviceIdStorage, type DeviceIdStorage } from './device-id-storage';
export { getCurrentPlace, type LocationResult } from './location';
export { useAppForeground } from './use-app-foreground';
export { APP_SCHEME, parseTripLink, tripLink } from './links';
export { useIncomingTripLink } from './links-native';
