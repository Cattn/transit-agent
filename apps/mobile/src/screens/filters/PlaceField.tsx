import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePlaceSearch } from '@transit/client-react';
import type { Place } from '@transit/shared';

export interface PlaceFieldColors {
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  outline: string;
}

export interface PlaceFieldProps {
  near?: Place['coordinates'];
  showLocation: boolean;
  locating: boolean;
  notice?: string;
  colors: PlaceFieldColors;
  onPick: (place: Place) => void;
  onUseLocation: () => void;
}

function placeName(place: Place): string {
  return place.name ?? `${place.coordinates[1].toFixed(4)}, ${place.coordinates[0].toFixed(4)}`;
}

export function PlaceField({ near, showLocation, locating, notice, colors, onPick, onUseLocation }: PlaceFieldProps) {
  const [query, setQuery] = useState('');
  const { results, loading } = usePlaceSearch(query, { near });
  const trimmed = query.trim();

  return (
    <View style={styles.wrap}>
      <TextInput
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={setQuery}
        placeholder="Search places"
        placeholderTextColor={colors.onSurfaceVariant}
        style={[styles.input, { color: colors.onSurface, borderColor: colors.outline, backgroundColor: colors.surface }]}
      />
      {showLocation ? (
        <Pressable accessibilityRole="button" disabled={locating} onPress={onUseLocation} style={styles.row}>
          <Text style={[styles.action, { color: colors.primary }]}>{locating ? 'Finding your location…' : 'Use my location'}</Text>
        </Pressable>
      ) : null}
      {notice ? <Text style={[styles.hint, { color: colors.primary }]}>{notice}</Text> : null}
      {trimmed.length > 0 && trimmed.length < 3 ? <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Type at least 3 letters</Text> : null}
      {loading ? <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Searching…</Text> : null}
      {!loading && trimmed.length >= 3 && results.length === 0 ? <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>No places found</Text> : null}
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.results}>
        {results.map((place, index) => (
          <Pressable
            key={`${index}-${place.coordinates.join(',')}`}
            accessibilityRole="button"
            onPress={() => onPick(place)}
            style={[styles.row, { borderTopColor: colors.outline }]}
          >
            <Text style={{ color: colors.onSurface }}>{placeName(place)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  row: { paddingVertical: 10 },
  action: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 14 },
  results: { maxHeight: 240 }
});
