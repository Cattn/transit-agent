import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { toTripRequest, type DraftChangeSource, type DraftState, type Itinerary, type LngLat, type Place, type PlanResponse, type SavedItinerary, type TravelProfile, type TripDraft, type TripDraftPatch, type TripRequest } from '@transit/shared';
import { useApi, useNow, usePlanTrip, useSavedItineraries, useTripDraft } from '@transit/client-react';
import { assignRouteColors } from '@transit/maps';
import { getCurrentPlace, useAppForeground } from '../../platform';
import { apiMode } from '../../data/client';
import { RouteMap } from '../../map/RouteMap';
import { useLiveLocation } from '../../map/useLiveLocation';
import type { RootStackParamList } from '../../navigation/types';
import { useAppColors } from '../../theme/appearance';
import { light as lightTheme, type AppColors } from '../../theme/colors';
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
  onOpenTrip: (id: string) => void;
  tripsLoading: boolean;
  tripsError?: string;
  onRetryTrips: () => void;
  sheetHeight: number;
  onSheetLayout: (height: number) => void;
  onTopLayout?: (bottomEdge: number) => void;
}

type TripAction = { id: string; kind: 'watch'; watch: boolean } | { id: string; kind: 'delete' };

const MAP_PADDING = 16;
const MAP_BUTTON_COLUMN = 64;

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

interface MapSlotProps {
  padding: { top: number; right: number; bottom: number; left: number };
  colors: AppColors;
  trips: Itinerary[];
  routeColors: ReadonlyMap<string, string>;
  selectedItineraryId?: string;
  onSelect: (itineraryId: string) => void;
  onDeselect: () => void;
  userLocation?: LngLat;
  userHeading?: number;
  locateKey?: number;
  unfocusedColors: 'trip' | 'mode';
  variant: 'saved' | 'choosing';
}

function MapSlot({ padding, colors, trips, routeColors, selectedItineraryId, onSelect, onDeselect, userLocation, userHeading, locateKey, unfocusedColors, variant }: MapSlotProps) {
  return (
    <View accessibilityLabel={`Map, ${trips.length} routes`} accessibilityValue={{ text: selectedItineraryId }} style={[StyleSheet.absoluteFill, { backgroundColor: colors.map }]}>
      <RouteMap
        itineraries={trips}
        selectedItineraryId={selectedItineraryId}
        onRouteSelect={onSelect}
        onDeselect={onDeselect}
        styleUrl={MAP_STYLE_URL}
        userLocation={userLocation}
        userHeading={userHeading}
        locateKey={locateKey}
        fitKey={trips.map((trip) => trip.id).join()}
        padding={padding}
        routeColors={routeColors}
        unfocusedColors={unfocusedColors}
        variant={variant}
        accentColor={lightTheme.primary}
      />
    </View>
  );
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const colors = useAppColors();
  const api = useApi();
  const foreground = useAppForeground();
  const now = useNow(15_000);
  const { state, apply, reset, restore, request } = useTripDraft();
  const { items, loading: tripsLoading, error: tripsError, refresh: refreshTrips, save, update, remove } = useSavedItineraries({ pollMs: 30_000, enabled: foreground });
  const [tripsListed, setTripsListed] = useState(false);
  if (!tripsListed && (items.length > 0 || tripsError || tripsLoading)) setTripsListed(true);
  const [saveFailed, setSaveFailed] = useState<{ itinerary: Itinerary; request: TripRequest }>();
  const [openSavedId, setOpenSavedId] = useState<string>();
  const [tripAction, setTripAction] = useState<TripAction>();
  const [profile, setProfile] = useState<TravelProfile>();
  const [status, setStatus] = useState(apiMode === 'mock' ? '' : 'Connecting…');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [topBarEdge, setTopBarEdge] = useState(0);
  const [here, setHere] = useState<LngLat>();
  const [locateKey, setLocateKey] = useState<number>();
  const [tracking, setTracking] = useState(false);
  const live = useLiveLocation(tracking && foreground);
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

  const closeSaved = useCallback(() => {
    setOpenSavedId(undefined);
    setTripAction(undefined);
  }, []);

  const runTripAction = useCallback((action: TripAction) => {
    setTripAction(undefined);
    const task = action.kind === 'watch' ? update(action.id, { watch: action.watch }) : remove(action.id);
    task.catch(() => setTripAction(action));
  }, [update, remove]);

  const showRoutes = useCallback(() => {
    closeSaved();
    setFilterField(undefined);
    setFilterSearch(undefined);
    setChatBehind(false);
    setSheet(undefined);
    setResultsOpen(true);
  }, [closeSaved]);

  const applyAgent = useCallback((patch: TripDraftPatch, source: DraftChangeSource) => {
    edited.current = true;
    apply(patch, source);
  }, [apply]);

  const onAgentPlan = useCallback((agent: PlanResponse, draft: TripDraft) => {
    closeSaved();
    setAgentPlan({ plan: agent, draft });
    setResultsOpen(true);
  }, [closeSaved]);

  const chat = useChatSession(state, applyAgent, onAgentPlan);

  const selectAgentCard = useCallback((snapshot: DraftState, agent: PlanResponse, id: string) => {
    edited.current = true;
    restore(snapshot);
    setAgentPlan({ plan: agent, draft: snapshot.draft });
    const next = toTripRequest(snapshot.draft);
    setSelection({ key: next.ok ? JSON.stringify(next.request) : '', id });
    showRoutes();
  }, [restore, showRoutes]);

  const group = groupForModes(state.draft.modes);
  const onGroupChange = useCallback((next: ModeGroupName) => {
    editDraft({ modes: modesForGroup(next, state.draft.modes) });
    if (next === 'fly') setSheet('fly');
  }, [editDraft, state.draft.modes]);

  useEffect(() => {
    let active = true;
    getCurrentPlace().then((result) => {
      if (!active || !result.ok) return;
      setHere(result.place.coordinates);
      setTracking(true);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const onLocate = useCallback(async () => {
    setLocating(true);
    const result = await getCurrentPlace();
    setLocating(false);
    if (result.ok) {
      setHere(result.place.coordinates);
      setTracking(true);
      setLocateKey((key) => (key ?? 0) + 1);
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

  const openSaved = resultsOpen ? undefined : items.find((item) => item.id === openSavedId);

  useEffect(() => {
    if (!resultsOpen && !openSaved) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (resultsOpen) closeResults();
      else closeSaved();
      return true;
    });
    return () => subscription.remove();
  }, [resultsOpen, openSaved, closeResults, closeSaved]);

  const swapPlaces = useCallback(() => {
    editDraft({ origin: state.draft.destination ?? null, destination: state.draft.origin ?? null });
  }, [state.draft.origin, state.draft.destination, editDraft]);

  useEffect(() => {
    if (!requestKey || currentPlan) { clearPlan(); return; }
    void runPlan(JSON.parse(requestKey) as TripRequest);
  }, [requestKey, currentPlan, runPlan, clearPlan]);

  const savedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const savedColors = useMemo(() => new Map(items.flatMap((item) => (item.color ? [[item.id, item.color] as const] : []))), [items]);

  const watched = useMemo(() => items.filter((trip) => trip.watch), [items]);
  const mapTrips = useMemo<Itinerary[]>(() => {
    if (resultsOpen) return [...(plan.data?.itineraries ?? []), ...(plan.data?.nearMisses ?? []), ...(plan.data?.returnPlan?.options.map((option) => option.itinerary) ?? [])];
    return openSaved && !openSaved.watch ? [...watched, openSaved] : watched;
  }, [resultsOpen, plan.data, watched, openSaved]);
  const shownIds = mapTrips.map((it) => it.id).join(' ');
  const savedPlan = useMemo(() => (openSaved ? { data: { itineraries: [openSaved], nearMisses: [], warnings: [] }, loading: false } : undefined), [openSaved]);
  const routeColors = useMemo(() => assignRouteColors(shownIds ? shownIds.split(' ') : [], savedColors), [shownIds, savedColors]);

  const saveResult = useCallback((itinerary: Itinerary, tripRequest: TripRequest) => {
    setSaveFailed(undefined);
    save({ itinerary, request: tripRequest, watch: true, color: routeColors.get(itinerary.id) }).catch(() => setSaveFailed({ itinerary, request: tripRequest }));
  }, [save, routeColors]);

  const padding = useMemo(
    () => ({ top: topBarEdge + MAP_PADDING, right: MAP_PADDING + MAP_BUTTON_COLUMN, bottom: sheetHeight, left: MAP_PADDING }),
    [topBarEdge, sheetHeight]
  );
  const clearSelection = useCallback(() => setSelectedId(undefined), [setSelectedId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapSlot
        padding={padding}
        colors={colors}
        trips={mapTrips}
        routeColors={routeColors}
        selectedItineraryId={resultsOpen ? selectedId : openSaved?.id}
        onSelect={resultsOpen ? setSelectedId : setOpenSavedId}
        onDeselect={resultsOpen ? clearSelection : closeSaved}
        userLocation={live.location ?? here}
        userHeading={live.heading}
        locateKey={locateKey}
        unfocusedColors={resultsOpen ? 'mode' : 'trip'}
        variant={resultsOpen ? 'choosing' : 'saved'}
      />
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
      ) : openSaved && savedPlan ? (
        <ResultsScreen
          colors={colors}
          draftState={{ draft: openSaved.request, provenance: {} }}
          request={{ ok: true, request: openSaved.request }}
          plan={savedPlan}
          now={now}
          savedIds={savedIds}
          selectedId={openSaved.id}
          onSelect={() => undefined}
          onSave={() => undefined}
          onRetrySave={() => undefined}
          savedTrip={{
            title: openSaved.label ?? 'Saved trip',
            watch: openSaved.watch,
            error: tripAction?.id === openSaved.id ? (tripAction.kind === 'watch' ? 'Could not update this trip. Check your connection and try again.' : 'Could not delete this trip. Check your connection and try again.') : undefined,
            onToggleWatch: (watch) => runTripAction({ id: openSaved.id, kind: 'watch', watch }),
            onDelete: () => runTripAction({ id: openSaved.id, kind: 'delete' }),
            onRetry: () => { if (tripAction) runTripAction(tripAction); }
          }}
          onBack={closeSaved}
          onSheetLayout={setSheetHeight}
        />
      ) : (
        <HomeChrome
          colors={colors}
          group={group}
          onGroupChange={onGroupChange}
          trips={items}
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
          onOpenTrip={setOpenSavedId}
          tripsLoading={!tripsListed || (tripsLoading && items.length === 0 && !tripsError)}
          tripsError={tripsError ? (items.length ? 'Could not sync saved trips.' : 'Could not load saved trips.') : undefined}
          onRetryTrips={() => void refreshTrips()}
          sheetHeight={sheetHeight}
          onSheetLayout={setSheetHeight}
          onTopLayout={setTopBarEdge}
        />
      )}
      {sheet === 'chat' ? (
        <ChatScreen draft={state} chat={chat} now={now} onOpenFilters={(field) => { setChatBehind(true); openFilters(field); }} onSelectCard={selectAgentCard} onClose={closeSheet} />
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
