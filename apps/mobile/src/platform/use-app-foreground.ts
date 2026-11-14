import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * True while the app is on screen. Use it to pause polling when the phone is locked or the app is
 * switched away (battery), e.g. `useSavedItineraries({ enabled: useAppForeground() })` (plan 015).
 */
export function useAppForeground(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  return active;
}
