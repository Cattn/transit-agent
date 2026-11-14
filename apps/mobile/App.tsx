import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createApiClient, sections } from '@transit/shared';

const api = createApiClient(
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001')
);

export default function App() {
  const [status, setStatus] = useState('Connecting to the server…');

  useEffect(() => {
    let active = true;
    api.health().then(() => {
      if (active) setStatus('Server connected');
    }).catch(() => {
      if (active) setStatus('Server unavailable. Check your API URL and restart.');
    });
    return () => { active = false; };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <Text style={styles.eyebrow}>TRANSIT AGENT</Text>
          <Text accessibilityRole="header" style={styles.title}>A better way to get there.</Text>
          <Text style={styles.intro}>Plan the whole journey around what matters to you.</Text>
          {sections.map((section) => (
            <View key={section.id} style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>{section.title}</Text>
              <Text style={styles.description}>{section.description}</Text>
              <Text style={styles.badge}>Coming soon</Text>
            </View>
          ))}
          <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f2' },
  content: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48, gap: 16 },
  eyebrow: { color: '#34735e', fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#122b25', fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  intro: { color: '#52665c', fontSize: 18, lineHeight: 28, marginBottom: 16 },
  card: { padding: 24, borderWidth: 1, borderColor: '#dce5dc', borderRadius: 18, backgroundColor: '#fff', gap: 12 },
  cardTitle: { color: '#122b25', fontSize: 24, fontWeight: '600' },
  description: { color: '#52665c', fontSize: 16, lineHeight: 24 },
  badge: { color: '#34735e', fontSize: 12, fontWeight: '600' },
  status: { color: '#52665c', fontSize: 14, marginTop: 16 }
});
