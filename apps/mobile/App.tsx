import { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { ApiProvider } from '@transit/client-react';
import { useAppClient } from './src/data/client';
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

function Starting() {
  const colors = useAppColors();
  return (
    <View accessibilityLabel="Starting Transit Agent" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function App() {
  const client = useAppClient();
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        {client ? (
          <ApiProvider client={client}>
            <ThemedNavigation />
          </ApiProvider>
        ) : <Starting />}
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
