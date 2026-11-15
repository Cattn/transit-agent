import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { ApiClient } from '@transit/shared';

export function useWatchLocation(api: ApiClient, ids: string, active: boolean): string | undefined {
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!active || !ids) return;
    let stopped = false;
    let sending = false;
    let subscription: Location.LocationSubscription | undefined;
    const targets = JSON.parse(ids) as string[];
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is off. Enable it or use the boarding buttons.');
      if (stopped) return;
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 15_000, distanceInterval: 0 }, (position) => {
        if (stopped || sending || Date.now() - position.timestamp > 30_000) return;
        const { longitude, latitude, accuracy } = position.coords;
        sending = true;
        void Promise.all(targets.map((id) => api.reportWatchLocation(id, { coordinates: [longitude, latitude], accuracyMeters: accuracy ?? undefined })))
          .then(() => { if (!stopped) setError(undefined); })
          .catch(() => { if (!stopped) setError('Could not share trip location. Use the boarding buttons or check your connection.'); })
          .finally(() => { sending = false; });
      });
      if (stopped) subscription.remove();
    })().catch((cause: unknown) => {
      if (!stopped) setError(cause instanceof Error ? cause.message : 'Could not read your location. Use the boarding buttons.');
    });
    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, [api, ids, active]);
  return active && ids ? error : undefined;
}
