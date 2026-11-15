import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { dark, light, type AppColors } from './colors';

export type AppearancePreference = 'system' | 'light' | 'dark';

interface AppearanceValue {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
}

const APPEARANCE_KEY = 'transit.appearance';

function isPreference(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

const AppearanceContext = createContext<AppearanceValue>({ preference: 'system', setPreference: () => undefined });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setStored] = useState<AppearancePreference>('system');

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(APPEARANCE_KEY).then((saved) => {
      if (active && isPreference(saved)) setStored(saved);
    }).catch((error) => console.warn('Unable to load appearance', error));
    return () => { active = false; };
  }, []);

  const setPreference = useCallback((next: AppearancePreference) => {
    setStored(next);
    SecureStore.setItemAsync(APPEARANCE_KEY, next).catch((error) => console.warn('Unable to save appearance', error));
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext);
}

export function useAppColors(): AppColors {
  const { preference } = useContext(AppearanceContext);
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return scheme === 'dark' ? dark : light;
}
