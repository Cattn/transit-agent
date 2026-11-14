import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Place, SavedItinerary, TravelProfile } from '@transit/shared';
import { useApi, useNow, useSavedItineraries, useTripDraft } from '@transit/client-react';
import { getCurrentPlace, useAppForeground } from '../../platform';
import { apiMode } from '../../data/client';
import type { RootStackParamList } from '../../navigation/types';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { ChatScreen } from '../chat/ChatScreen';
import { FiltersScreen } from '../filters/FiltersScreen';
import { FlyScreen } from '../fly/FlyScreen';
import { HomeChrome as AndroidChrome } from './HomeChrome.android';
import { HomeChrome as IosChrome } from './HomeChrome.ios';
import { groupForModes, modesForGroup, type ModeGroupName } from './ModeSlider';

export interface SavedPlaceChip {
  key: 'home' | 'office' | 'gym';
  label: string;
  onPress: () => void;
}

export interface HomeChromeProps {
  colors: AppColors;
  group: ModeGroupName;
  onGroupChange: (group: ModeGroupName) => void;
  trips: SavedItinerary[];
  watchingCount: number;
  now: Date;
  chips: SavedPlaceChip[];
  locating: boolean;
  notice?: string;
  status: string;
  onLocate: () => void;
  onAskAgent: () => void;
  onOpenSettings: () => void;
  onOpenFilters: () => void;
  sheetHeight: number;
  onSheetLayout: (height: number) => void;
}

const HomeChrome = Platform.OS === 'ios' ? IosChrome : AndroidChrome;
const MAP_PADDING = 16;

function MapSlot({ padding, colors }: { padding: { top: number; right: number; bottom: number; left: number }; colors: AppColors }) {
  return <View accessibilityLabel="Map" style={[StyleSheet.absoluteFill, { backgroundColor: colors.map, paddingBottom: padding.bottom }]} />;
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const colors = useAppColors();
  const api = useApi();
  const foreground = useAppForeground();
  const now = useNow(15_000);
  const { state, apply, reset } = useTripDraft();
  const { items } = useSavedItineraries({ pollMs: 30_000, enabled: foreground });
  const [profile, setProfile] = useState<TravelProfile>();
  const [status, setStatus] = useState('Connecting…');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [sheet, setSheet] = useState<'chat' | 'filters' | 'fly'>();
  const edited = useRef(false);

  useEffect(() => {
    let active = true;
    api.health().then(() => {
      if (active) setStatus(apiMode === 'mock' ? 'Sample data' : 'Server connected');
    }).catch(() => {
      if (active) setStatus('Server unavailable. Check your API URL and restart.');
    });
    api.getProfile().then((loaded) => {
      if (!active || !loaded) return;
      setProfile(loaded);
      if (!edited.current && Object.keys(loaded.defaults).length > 0) reset(loaded.defaults);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [api, reset]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const editDraft = useCallback((patch: Parameters<typeof apply>[0]) => {
    edited.current = true;
    apply(patch, 'user');
  }, [apply]);

  const group = groupForModes(state.draft.modes);
  const onGroupChange = useCallback((next: ModeGroupName) => {
    editDraft({ modes: modesForGroup(next) });
    if (next === 'fly') setSheet('fly');
  }, [editDraft]);

  const onLocate = useCallback(async () => {
    setLocating(true);
    const result = await getCurrentPlace();
    setLocating(false);
    if (result.ok) {
      editDraft({ origin: result.place });
      setNotice('Starting from your current location.');
    } else {
      setNotice(result.reason === 'denied' ? 'Location is off for Transit Agent. You can turn it on in Settings.' : 'Could not find your location. Try again.');
    }
  }, [editDraft]);

  const chips = useMemo<SavedPlaceChip[]>(() => {
    const chip = (key: SavedPlaceChip['key'], label: string, place: Place | undefined): SavedPlaceChip => ({
      key,
      label,
      onPress: () => (place ? editDraft({ destination: place }) : setSheet('filters'))
    });
    return [chip('home', 'Home', profile?.home), chip('office', 'Office', profile?.work), chip('gym', 'Gym', undefined)];
  }, [profile, editDraft]);

  const watched = items.filter((trip) => trip.watch);
  const padding = { top: MAP_PADDING, right: MAP_PADDING, bottom: sheetHeight, left: MAP_PADDING };
  const closeSheet = () => setSheet(undefined);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapSlot padding={padding} colors={colors} />
      <HomeChrome
        colors={colors}
        group={group}
        onGroupChange={onGroupChange}
        trips={watched}
        watchingCount={watched.length}
        now={now}
        chips={chips}
        locating={locating}
        notice={notice}
        status={status}
        onLocate={() => void onLocate()}
        onAskAgent={() => setSheet('chat')}
        onOpenSettings={() => navigation.navigate('Settings')}
        onOpenFilters={() => setSheet('filters')}
        sheetHeight={sheetHeight}
        onSheetLayout={setSheetHeight}
      />
      <Modal visible={sheet !== undefined} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSheet}>
        {sheet === 'chat' ? <ChatScreen onClose={closeSheet} /> : null}
        {sheet === 'filters' ? <FiltersScreen onClose={closeSheet} /> : null}
        {sheet === 'fly' ? <FlyScreen onClose={closeSheet} /> : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
