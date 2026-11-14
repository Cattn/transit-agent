import * as SecureStore from 'expo-secure-store';

/**
 * Where the anonymous device ID (decision D4) lives between launches.
 * Defined locally because plan 015 (`@transit/client-react`) hasn't landed yet; when it does,
 * import its `DeviceIdStorage` instead and delete this copy. The shapes are identical.
 */
export interface DeviceIdStorage {
  get(): Promise<string | null>;
  set(id: string): Promise<void>;
}

export const DEVICE_ID_KEY = 'transit.deviceId';

/** Keychain (iOS) / Keystore-backed storage (Android) via expo-secure-store. */
export const secureStoreDeviceIdStorage: DeviceIdStorage = {
  get: () => SecureStore.getItemAsync(DEVICE_ID_KEY),
  set: (id) => SecureStore.setItemAsync(DEVICE_ID_KEY, id)
};
