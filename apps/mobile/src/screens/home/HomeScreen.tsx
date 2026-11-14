import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Itinerary, Place, SavedItinerary, TravelProfile, TripDraftPatch, TripRequest } from '@transit/shared';
import { useApi, useNow, useSavedItineraries, useTripDraft } from '@transit/client-react';
import { getCurrentPlace, useAppForeground } from '../../platform';
import { apiMode } from '../../data/client';
import type { RootStackParamList } from '../../navigation/types';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { ChatScreen } from '../chat/ChatScreen';
import { FiltersScreen } from '../filters/FiltersScreen';
import { FlyScreen } from '../fly/FlyScreen';
import { ResultsScreen } from '../results/ResultsScreen';
import { HomeChrome } from './HomeChrome';
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

const MAP_PADDING = 16;

function MapSlot({ padding, colors, selectedItineraryId }: { padding: { top: number; right: number; bottom: number; left: number }; colors: AppColors; selectedItineraryId?: string }) {
  return <View accessibilityLabel="Map" accessibilityValue={{ text: selectedItineraryId }} style={[StyleSheet.absoluteFill, { backgroundColor: colors.map, paddingBottom: padding.bottom }]} />;
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const colors = useAppColors();
  const api = useApi();
  const foreground = useAppForeground();
  const now = useNow(15_000);
  const { state, apply, reset, request } = useTripDraft();
  const { items, save } = useSavedItineraries({ pollMs: 30_000, enabled: foreground });
  const [profile, setProfile] = useState<TravelProfile>();
  const [status, setStatus] = useState(apiMode === 'mock' ? '' : 'Connecting…');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [sheet, setSheet] = useState<'chat' | 'filters' | 'fly'>();
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const edited = useRef(false);

  useEffect(() => {
    let active = true;
    api.health().then(() => {
      if (active) setStatus(apiMode === 'mock' ? '' : 'Server connected');
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

  const searchTo = useCallback(async (destination: Place) => {
    const patch: TripDraftPatch = { destination };
    if (!state.draft.time) patch.time = { type: 'departAt', at: new Date().toISOString() };
    if (!state.draft.origin) {
      setLocating(true);
      const result = await getCurrentPlace();
      setLocating(false);
      if (result.ok) patch.origin = result.place;
    }
    editDraft(patch);
    setResultsOpen(true);
  }, [state.draft.time, state.draft.origin, editDraft]);

  const chips = useMemo<SavedPlaceChip[]>(() => {
    const chip = (key: SavedPlaceChip['key'], label: string, place: Place | undefined): SavedPlaceChip => ({
      key,
      label,
      onPress: () => (place ? void searchTo(place) : setSheet('filters'))
    });
    return [chip('home', 'Home', profile?.home), chip('office', 'Office', profile?.work), chip('gym', 'Gym', undefined)];
  }, [profile, searchTo]);

  const closeResults = useCallback(() => {
    setResultsOpen(false);
    setSelectedId(undefined);
  }, []);

  useEffect(() => {
    if (!resultsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeResults(); return true; });
    return () => subscription.remove();
  }, [resultsOpen, closeResults]);

  const swapPlaces = useCallback(() => {
    editDraft({ origin: state.draft.destination ?? null, destination: state.draft.origin ?? null });
  }, [state.draft.origin, state.draft.destination, editDraft]);

  const saveResult = useCallback((itinerary: Itinerary, tripRequest: TripRequest) => {
    save({ itinerary, request: tripRequest, watch: true }).catch(() => undefined);
  }, [save]);

  const savedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const watched = items.filter((trip) => trip.watch);
  const padding = { top: MAP_PADDING, right: MAP_PADDING, bottom: sheetHeight, left: MAP_PADDING };
  const closeSheet = () => setSheet(undefined);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapSlot padding={padding} colors={colors} selectedItineraryId={selectedId} />
      {resultsOpen ? (
        <ResultsScreen
          colors={colors}
          draftState={state}
          request={request}
          now={now}
          savedIds={savedIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSave={saveResult}
          onBack={closeResults}
          onSwap={swapPlaces}
          onOpenFilters={() => setSheet('filters')}
          onSheetLayout={setSheetHeight}
        />
      ) : (
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
      )}
      <Modal visible={sheet !== undefined} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSheet}>
        <SafeAreaProvider>
          {sheet === 'chat' ? <ChatScreen onClose={closeSheet} /> : null}
          {sheet === 'filters' ? <FiltersScreen onClose={closeSheet} /> : null}
          {sheet === 'fly' ? <FlyScreen onClose={closeSheet} /> : null}
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
