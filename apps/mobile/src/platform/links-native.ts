// Expo hook around the pure parseTripLink (links.ts). Plain .ts on purpose: with a `.native.ts`
// name, Metro would resolve this file's own `./links` import back to itself.
import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { parseTripLink } from './links';

/**
 * Calls `onTrip(id)` for a trip link that opened the app (once, on mount) and for any trip link
 * received while it is running. Other links are ignored.
 */
export function useIncomingTripLink(onTrip: (id: string) => void): void {
  const onTripRef = useRef(onTrip);
  useEffect(() => {
    onTripRef.current = onTrip;
  }, [onTrip]);

  useEffect(() => {
    let mounted = true;
    const handle = (url: string | null) => {
      const link = url ? parseTripLink(url) : null;
      if (mounted && link) onTripRef.current(link.tripId);
    };

    Linking.getInitialURL().then(handle).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}
