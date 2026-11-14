import * as Location from 'expo-location';
import type { Place } from '@transit/shared';

export type LocationResult = { ok: true; place: Place } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Asks for when-in-use permission at launch or on tap (018-Q1), then reads one position.
 * When-in-use only: no tracking while the app is closed.
 */
export async function getCurrentPlace(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { ok: false, reason: 'denied' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    // GeoJSON order, as in LngLatSchema: [longitude, latitude].
    return { ok: true, place: { name: 'Current location', coordinates: [coords.longitude, coords.latitude], kind: 'address' } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
