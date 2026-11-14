import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}
