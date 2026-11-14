import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LngLat } from '@transit/shared';

const HEADING_STEP = 5;

function angleBetween(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function useLiveLocation(active: boolean): { location?: LngLat; heading?: number } {
  const [location, setLocation] = useState<LngLat>();
  const [heading, setHeading] = useState<number>();

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const subscriptions: Location.LocationSubscription[] = [];
    const keep = (subscription: Location.LocationSubscription) => {
      if (stopped) subscription.remove();
      else subscriptions.push(subscription);
    };

    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted || stopped) return;
      keep(
        await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, ({ coords }) =>
          setLocation([coords.longitude, coords.latitude])
        )
      );
      keep(
        await Location.watchHeadingAsync(({ trueHeading, magHeading }) => {
          const next = trueHeading >= 0 ? trueHeading : magHeading;
          setHeading((previous) =>
            previous !== undefined && angleBetween(previous, next) < HEADING_STEP ? previous : Math.round(next)
          );
        })
      );
    })().catch(() => undefined);

    return () => {
      stopped = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [active]);

  return { location, heading };
}
