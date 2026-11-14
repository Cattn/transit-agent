import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type AppColors } from './colors';

export type AppearancePreference = 'system' | 'light' | 'dark';

interface AppearanceValue {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
}

const AppearanceContext = createContext<AppearanceValue>({ preference: 'system', setPreference: () => undefined });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<AppearancePreference>('system');
  const value = useMemo(() => ({ preference, setPreference }), [preference]);
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
