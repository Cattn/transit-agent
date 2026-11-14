import { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { ApiProvider } from '@transit/client-react';
import { client, useClientDeviceId } from './src/data/client';
import { RootStack } from './src/navigation/Root';
import { AppearanceProvider, useAppColors } from './src/theme/appearance';

function ThemedNavigation() {
  const colors = useAppColors();
  const theme = useMemo<Theme>(() => {
    const base = colors.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.onSurface, border: colors.outline }
    };
  }, [colors]);

  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      <RootStack />
    </NavigationContainer>
  );
}

export default function App() {
  useClientDeviceId();
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <ApiProvider client={client}>
          <ThemedNavigation />
        </ApiProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
