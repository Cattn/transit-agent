import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { DraftChangeSource, Itinerary, Place, PlanResponse, SavedItinerary, TravelProfile, TripDraft, TripDraftPatch, TripRequest } from '@transit/shared';
import { useApi, useNow, usePlanTrip, useSavedItineraries, useTripDraft } from '@transit/client-react';
import { assignRouteColors } from '@transit/maps';
import { getCurrentPlace, useAppForeground } from '../../platform';
import { apiMode } from '../../data/client';
import type { RootStackParamList } from '../../navigation/types';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { ChatScreen, useChatSession } from '../chat/ChatScreen';
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
  onSearch: () => void;
  tripsLoading: boolean;
  tripsError?: string;
  onRetryTrips: () => void;
  sheetHeight: number;
  onSheetLayout: (height: number) => void;
}

const MAP_PADDING = 16;

interface MapSlotProps {
  padding: { top: number; right: number; bottom: number; left: number };
  colors: AppColors;
  plan?: PlanResponse;
  routeColors: ReadonlyMap<string, string>;
  selectedItineraryId?: string;
}

function MapSlot({ padding, colors, plan, selectedItineraryId }: MapSlotProps) {
  return <View accessibilityLabel={plan ? `Map, ${plan.itineraries.length} routes` : 'Map'} accessibilityValue={{ text: selectedItineraryId }} style={[StyleSheet.absoluteFill, { backgroundColor: colors.map, paddingBottom: padding.bottom }]} />;
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const colors = useAppColors();
  const api = useApi();
  const foreground = useAppForeground();
  const now = useNow(15_000);
  const { state, apply, reset, request } = useTripDraft();
  const { items, loading: tripsLoading, error: tripsError, refresh: refreshTrips, save } = useSavedItineraries({ pollMs: 30_000, enabled: foreground });
  const [tripsListed, setTripsListed] = useState(false);
  if (!tripsListed && (items.length > 0 || tripsError || tripsLoading)) setTripsListed(true);
  const [saveFailed, setSaveFailed] = useState<{ itinerary: Itinerary; request: TripRequest }>();
  const [profile, setProfile] = useState<TravelProfile>();
  const [status, setStatus] = useState(apiMode === 'mock' ? '' : 'Connecting…');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [sheet, setSheet] = useState<'chat' | 'filters' | 'fly'>();
  const [chatBehind, setChatBehind] = useState(false);
  const [filterField, setFilterField] = useState<string>();
  const [filterSearch, setFilterSearch] = useState<'destination'>();
  const [resultsOpen, setResultsOpen] = useState(false);
  const [agentPlan, setAgentPlan] = useState<{ plan: PlanResponse; draft: TripDraft }>();
  const currentPlan = agentPlan?.draft === state.draft ? agentPlan.plan : undefined;
  const searched = usePlanTrip();
  const { run: runPlan, clear: clearPlan } = searched;
  const plan = currentPlan ? { data: currentPlan, loading: false } : searched;
  const requestKey = resultsOpen && request.ok ? JSON.stringify(request.request) : '';
  const [selection, setSelection] = useState<{ key: string; id?: string }>({ key: '' });
  const selectedId = selection.key === requestKey ? selection.id : undefined;
  const setSelectedId = useCallback((id: string | undefined) => setSelection({ key: requestKey, id }), [requestKey]);
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

  const applyUser = useCallback((patch: TripDraftPatch, source: 'user') => {
    edited.current = true;
    apply(patch, source);
  }, [apply]);

  const openFilters = useCallback((field?: string) => {
    setFilterField(field);
    setFilterSearch(undefined);
    setSheet('filters');
  }, []);

  const openSearch = useCallback(() => {
    setFilterField('destination');
    setFilterSearch('destination');
    setSheet('filters');
  }, []);

  const closeSheet = useCallback(() => {
    setFilterField(undefined);
    setFilterSearch(undefined);
    setSheet(chatBehind ? 'chat' : undefined);
    setChatBehind(false);
  }, [chatBehind]);

  const showRoutes = useCallback(() => {
    setFilterField(undefined);
    setFilterSearch(undefined);
    setChatBehind(false);
    setSheet(undefined);
    setResultsOpen(true);
  }, []);

  const applyAgent = useCallback((patch: TripDraftPatch, source: DraftChangeSource) => {
    edited.current = true;
    apply(patch, source);
  }, [apply]);

  const onAgentPlan = useCallback((agent: PlanResponse, draft: TripDraft) => {
    setAgentPlan({ plan: agent, draft });
    setResultsOpen(true);
  }, []);

  const chat = useChatSession(state, applyAgent, onAgentPlan);

  const group = groupForModes(state.draft.modes);
  const onGroupChange = useCallback((next: ModeGroupName) => {
    editDraft({ modes: modesForGroup(next, state.draft.modes) });
    if (next === 'fly') setSheet('fly');
  }, [editDraft, state.draft.modes]);

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
    const origin = state.draft.origin;
    if (!origin || (origin.coordinates[0] === destination.coordinates[0] && origin.coordinates[1] === destination.coordinates[1])) {
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
      onPress: () => (place ? void searchTo(place) : openFilters())
    });
    return [chip('home', 'Home', profile?.home), chip('office', 'Office', profile?.work), chip('gym', 'Gym', undefined)];
  }, [profile, searchTo, openFilters]);

  const closeResults = useCallback(() => {
    setResultsOpen(false);
    setSaveFailed(undefined);
  }, []);

  useEffect(() => {
    if (!resultsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeResults(); return true; });
    return () => subscription.remove();
  }, [resultsOpen, closeResults]);

  const swapPlaces = useCallback(() => {
    editDraft({ origin: state.draft.destination ?? null, destination: state.draft.origin ?? null });
  }, [state.draft.origin, state.draft.destination, editDraft]);

  useEffect(() => {
    if (!requestKey || currentPlan) { clearPlan(); return; }
    void runPlan(JSON.parse(requestKey) as TripRequest);
  }, [requestKey, currentPlan, runPlan, clearPlan]);

  const savedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const savedColors = useMemo(() => new Map(items.flatMap((item) => (item.color ? [[item.id, item.color] as const] : []))), [items]);

  const watched = items.filter((trip) => trip.watch);
  const shownIds = resultsOpen
    ? [...(plan.data?.itineraries ?? []), ...(plan.data?.nearMisses ?? [])].map((it) => it.id).join(' ')
    : watched.map((trip) => trip.id).join(' ');
  const routeColors = useMemo(() => assignRouteColors(shownIds ? shownIds.split(' ') : [], savedColors), [shownIds, savedColors]);

  const saveResult = useCallback((itinerary: Itinerary, tripRequest: TripRequest) => {
    setSaveFailed(undefined);
    save({ itinerary, request: tripRequest, watch: true, color: routeColors.get(itinerary.id) }).catch(() => setSaveFailed({ itinerary, request: tripRequest }));
  }, [save, routeColors]);

  const padding = { top: MAP_PADDING, right: MAP_PADDING, bottom: sheetHeight, left: MAP_PADDING };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapSlot padding={padding} colors={colors} plan={resultsOpen ? plan.data : undefined} routeColors={routeColors} selectedItineraryId={selectedId} />
      {resultsOpen ? (
        <ResultsScreen
          colors={colors}
          draftState={state}
          request={request}
          plan={plan}
          now={now}
          savedIds={savedIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSave={saveResult}
          saveError={saveFailed && !savedIds.has(saveFailed.itinerary.id) ? 'Could not save this trip. Check your connection and try again.' : undefined}
          onRetrySave={() => { if (saveFailed) saveResult(saveFailed.itinerary, saveFailed.request); }}
          onBack={closeResults}
          onSwap={swapPlaces}
          onOpenFilters={() => openFilters()}
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
          onOpenFilters={() => openFilters()}
          onSearch={openSearch}
          tripsLoading={!tripsListed || (tripsLoading && items.length === 0 && !tripsError)}
          tripsError={tripsError ? (items.length ? 'Could not sync saved trips.' : 'Could not load saved trips.') : undefined}
          onRetryTrips={() => void refreshTrips()}
          sheetHeight={sheetHeight}
          onSheetLayout={setSheetHeight}
        />
      )}
      {sheet === 'chat' ? (
        <ChatScreen draft={state} chat={chat} onOpenFilters={(field) => { setChatBehind(true); openFilters(field); }} onClose={closeSheet} />
      ) : null}
      {sheet === 'filters' ? (
        <FiltersScreen
          draft={state.draft}
          provenance={state.provenance}
          apply={applyUser}
          field={filterField}
          plan={plan}
          startSearch={filterSearch}
          onClose={closeSheet}
          onShowRoutes={showRoutes}
        />
      ) : null}
      <Modal visible={sheet === 'fly'} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSheet}>
        <SafeAreaProvider>
          <FlyScreen onClose={closeSheet} />
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});
