import * as Location from 'expo-location';
import type { LngLat, Place } from '@transit/shared';

export function currentLocationPlace(coordinates: LngLat): Place {
  return { name: 'Current location', coordinates, kind: 'address' };
}

const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;
const LAST_KNOWN_ACCURACY_M = 200;

export async function getLastKnownLocation(): Promise<LngLat | undefined> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return undefined;
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS, requiredAccuracy: LAST_KNOWN_ACCURACY_M });
    return last ? [last.coords.longitude, last.coords.latitude] : undefined;
  } catch {
    return undefined;
  }
}

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
    return { ok: true, place: currentLocationPlace([coords.longitude, coords.latitude]) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
