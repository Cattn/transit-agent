import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { PlaceField } from '../filters/PlaceField';
import type { Choice, SettingsChromeProps } from './SettingsScreen';

const COMING_SOON = 'Coming soon';

function choose<T>(title: string, options: Choice<T>[], onPick: (value: T) => void) {
  Alert.alert(title, undefined, [
    ...options.map((option) => ({ text: option.selected ? `✓ ${option.label}` : option.label, onPress: () => onPick(option.value) })),
    { text: 'Cancel', style: 'cancel' as const }
  ]);
}

interface RowProps {
  colors: AppColors;
  title: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  children?: ReactNode;
}

function Row({ colors, title, value, onPress, disabled, children }: RowProps) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={disabled || !onPress} onPress={onPress} style={[styles.row, { backgroundColor: colors.surface, opacity: disabled ? 0.38 : 1 }]}>
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        {value ? <Text style={[styles.value, { color: colors.onSurfaceVariant }]}>{value}</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}

function Label({ colors, children }: { colors: AppColors; children: string }) {
  return <Text style={[styles.label, { color: colors.primary }]}>{children}</Text>;
}

export function SettingsChrome(props: SettingsChromeProps) {
  const colors = useAppColors();
  const [mpg, setMpg] = useState<string>();

  if (!props.ready) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {props.loadError ? (
          <>
            <Text style={{ color: colors.onSurfaceVariant }}>{props.loadError}</Text>
            <Pressable accessibilityRole="button" onPress={props.onRetryLoad}>
              <Text style={[styles.link, { color: colors.primary }]}>Retry</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const saveMpg = () => {
    const parsed = Number((mpg ?? '').trim());
    setMpg(undefined);
    props.onCarMpg(mpg?.trim() && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : undefined);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {props.saveError ? <Text style={[styles.error, { color: colors.onErrorContainer, backgroundColor: colors.errorContainer }]}>{props.saveError}</Text> : null}
      <Label colors={colors}>Places</Label>
      {props.places.map((place) => (
        <View key={place.key}>
          <Row colors={colors} title={place.title} value={place.value} onPress={() => props.onEditPlace(place.key)} />
          {props.editingPlace === place.key ? (
            <PlaceField
              near={props.placeSearch.near}
              showLocation
              locating={props.placeSearch.locating}
              notice={props.placeSearch.notice}
              colors={colors}
              onPick={props.placeSearch.onPick}
              onUseLocation={props.placeSearch.onUseLocation}
            />
          ) : null}
        </View>
      ))}
      <Row colors={colors} title="Add a place" value={COMING_SOON} disabled />

      <Label colors={colors}>Trip defaults</Label>
      <View style={[styles.chips, { backgroundColor: colors.surface }]}>
        {props.modes.map((mode) => (
          <Pressable key={mode.mode} accessibilityRole="button" accessibilityState={{ selected: mode.selected }} onPress={() => props.onToggleMode(mode.mode)} style={[styles.chip, { borderColor: colors.outline, backgroundColor: mode.selected ? colors.primaryContainer : 'transparent' }]}>
            <Text style={{ color: colors.onSurface }}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>
      <Row
        colors={colors}
        title="Comfort"
        value={props.comfort < 0.35 ? 'Cheaper' : props.comfort > 0.65 ? 'Comfier' : 'Balanced'}
        onPress={() => choose('Comfort', [
          { value: 0.2, label: 'Cheaper', selected: props.comfort < 0.35 },
          { value: 0.5, label: 'Balanced', selected: props.comfort >= 0.35 && props.comfort <= 0.65 },
          { value: 0.8, label: 'Comfier', selected: props.comfort > 0.65 }
        ], props.onComfort)}
      />
      {props.limits.map((item) => (
        <Row key={item.key} colors={colors} title={item.title} value={item.label} onPress={() => choose(item.title, item.options, (value) => props.onLimit(item.key, value))} />
      ))}
      <Row colors={colors} title="Arrival strictness" value={props.late.label} onPress={() => choose('Arrival strictness', props.late.options, props.onLateTolerance)} />
      <Row colors={colors} title="Step-free routes only">
        <Switch value={props.stepFree} onValueChange={props.onStepFree} />
      </Row>

      <Label colors={colors}>Vehicles</Label>
      <Row colors={colors} title="Car fuel economy" value={props.carMpgLabel} onPress={() => setMpg(props.carMpg === undefined ? '' : String(props.carMpg))} />
      {mpg !== undefined ? (
        <TextInput
          autoFocus
          keyboardType="decimal-pad"
          value={mpg}
          onChangeText={setMpg}
          onSubmitEditing={saveMpg}
          onBlur={saveMpg}
          placeholder="mpg"
          placeholderTextColor={colors.onSurfaceVariant}
          style={[styles.input, { color: colors.onSurface, borderColor: colors.outline }]}
        />
      ) : null}

      <Label colors={colors}>Leave reminders</Label>
      <Row colors={colors} title="Watch saved trips" value={COMING_SOON} disabled />
      <Row colors={colors} title="Buffer before “leave now”" value={COMING_SOON} disabled />
      <Row colors={colors} title="Agent can suggest the next option" value={COMING_SOON} disabled />

      <Label colors={colors}>Display & region</Label>
      <Row colors={colors} title="Time zone" value={props.timeZone.label} onPress={() => choose('Time zone', props.timeZone.options, props.onTimeZone)} />
      <Row colors={colors} title="Theme" value={props.theme.label} onPress={() => choose('Theme', props.theme.options, props.onTheme)} />

      <Label colors={colors}>About</Label>
      <Row colors={colors} title="Device ID" value={props.deviceId} />
      <Row colors={colors} title="Data sources" value={props.dataSources} />
      <Row colors={colors} title="Version" value={props.version} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  content: { padding: 16, gap: 2, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4 },
  rowText: { flex: 1 },
  title: { fontSize: 16 },
  value: { fontSize: 14, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 4 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: 4, padding: 12, fontSize: 16, marginVertical: 4 },
  error: { fontSize: 14, marginBottom: 8 },
  link: { fontSize: 16, fontWeight: '600' }
});
