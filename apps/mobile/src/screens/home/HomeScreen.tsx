import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MAX_CUSTOM_PLACES, PRESET_ICONS, scheduledModes, toTripRequest, type AgentProgress, type DraftChangeSource, type DraftState, type Itinerary, type LngLat, type Place, type PlanResponse, type SavedItinerary, type TravelProfile, type TripDraft, type TripDraftPatch, type TripRequest, type PresetIcon, type PutProfileRequest, type UpdateItineraryRequest } from '@transit/shared';
import { useApi, useNow, usePlanTrip, useSavedItineraries, useTripDraft } from '@transit/client-react';
import { PALETTE, assignRouteColors, isPresetKey, nextPlaceColor, placeFor, presetTripColors, profilePlaces, removeCustomPlace, upsertCustomPlace, withPresetColors, type BuildPreview, type PlaceKey } from '@transit/maps';
import { currentLocationPlace, getCurrentPlace, getLastKnownLocation, useAppForeground } from '../../platform';
import { apiMode } from '../../data/client';
import { MapLoading, useMapLoad } from '../../map/MapLoading';
import { useWatchLocation } from '../../platform/use-watch-location';
import { tripCardText } from './TrackedTripCard';
import { RouteMap } from '../../map/RouteMap';
import { useLiveLocation } from '../../map/useLiveLocation';
import type { RootStackParamList } from '../../navigation/types';
import { useAppColors } from '../../theme/appearance';
import { light as lightTheme, type AppColors } from '../../theme/colors';
import { ChatScreen, useChatSession } from '../chat/ChatScreen';
import { FiltersScreen } from '../filters/FiltersScreen';
import { FlyScreen } from '../fly/FlyScreen';
import { ResultsScreen } from '../results/ResultsScreen';
import { profileSaved } from '../settings/SettingsScreen';
import { HomeChrome } from './HomeChrome';
import { PresetSheet, type PresetChoice } from './PresetSheet';
import { newPlaceId } from './place-id';
import { movePatch } from '../filters/places';
import { groupForModes, modesForGroup, type ModeGroupName } from './ModeSlider';

export interface SavedPlaceChip {
  key: PlaceKey;
  label: string;
  icon: PresetIcon;
  color: string;
  onPress: () => void;
  onEdit: () => void;
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
  onAddPlace?: () => void;
  onSearch: () => void;
  onOpenTrip: (id: string) => void;
  tripsLoading: boolean;
  tripsError?: string;
  onRetryTrips: () => void;
  sheetHeight: number;
  onSheetLayout: (height: number) => void;
  onTopLayout?: (bottomEdge: number) => void;
}

type TripAction = { id: string; kind: 'watch'; watch: boolean } | { id: string; kind: 'delete' } | { id: string; kind: 'update'; patch: UpdateItineraryRequest };

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
  buildPreview?: BuildPreview;
  fitKey: string;
  fitItineraryId?: string;
}


function agentBuildPreview({ phase, candidates, origin, destination, plan }: AgentProgress): BuildPreview | undefined {
  const ends = { origin: origin?.coordinates, destination: destination?.coordinates };
  if (phase === 'thinking' || phase === 'locating') return { phase: 'locating', candidates: candidates.map((place) => place.coordinates), ...ends };
  if (phase === 'searching') return { phase: 'searching', ...ends };
  if ((phase === 'routes' || phase === 'done') && plan) return { phase: 'drawing', ...ends };
  return undefined;
}

function MapSlot({ padding, colors, trips, routeColors, selectedItineraryId, onSelect, onDeselect, userLocation, userHeading, locateKey, unfocusedColors, variant, buildPreview, fitKey, fitItineraryId }: MapSlotProps) {
  const mapLoad = useMapLoad();
  return (
    <View accessibilityLabel={`Map, ${trips.length} routes`} accessibilityValue={{ text: selectedItineraryId }} style={[StyleSheet.absoluteFill, { backgroundColor: colors.map }]}>
      <RouteMap
        key={mapLoad.attempt}
        itineraries={trips}
        selectedItineraryId={selectedItineraryId}
        onRouteSelect={onSelect}
        onDeselect={onDeselect}
        styleUrl={MAP_STYLE_URL}
        userLocation={userLocation}
        userHeading={userHeading}
        locateKey={locateKey}
        fitKey={fitKey}
        fitItineraryId={fitItineraryId}
        padding={padding}
        routeColors={routeColors}
        unfocusedColors={unfocusedColors}
        variant={variant}
        accentColor={lightTheme.primary}
        buildPreview={buildPreview}
        onLoad={mapLoad.onLoad}
        onLoadError={mapLoad.onLoadError}
      />
      <MapLoading status={mapLoad.status} colors={colors} padding={padding} onRetry={mapLoad.retry} />
    </View>
  );
}

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const colors = useAppColors();
  const api = useApi();
  const focused = useIsFocused();
  const appForeground = useAppForeground();
  const foreground = appForeground && focused;
  const now = useNow(15_000);
  const { state, apply, fill, reset, restore, request } = useTripDraft();
  const [rerouting, setRerouting] = useState<{ client: typeof api; id: string; checkedAt?: string }>();
  const { items, loading: tripsLoading, error: tripsError, refresh: refreshTrips, save, update, remove } = useSavedItineraries({ pollMs: rerouting?.client === api ? 2000 : 30_000, enabled: foreground });
  const reroutingTrip = items.find((item) => item.id === rerouting?.id);
  if (rerouting?.client === api && reroutingTrip && !reroutingTrip.watchStatus?.pendingReplan && reroutingTrip.watchStatus?.checkedAt !== rerouting.checkedAt) setRerouting(undefined);
  const [tripsListed, setTripsListed] = useState(false);
  if (!tripsListed && (items.length > 0 || tripsError || tripsLoading)) setTripsListed(true);
  const [saveFailed, setSaveFailed] = useState<{ itinerary: Itinerary; request: TripRequest }>();
  const [openSavedId, setOpenSavedId] = useState<string>();
  const [tripAction, setTripAction] = useState<TripAction>();
  const [sharingTrips, setSharingTrips] = useState<{ client: typeof api; ids: ReadonlySet<string> }>({ client: api, ids: new Set() });
  const sharedIds = sharingTrips.client === api ? sharingTrips.ids : new Set<string>();
  const sharingIds = JSON.stringify(items.filter((trip) => sharedIds.has(trip.id) && trip.watch && trip.watchStatus?.state !== 'done' && Date.parse(trip.arriveAt) > now.getTime() && Date.parse(trip.departAt) - now.getTime() < 60 * 60_000).map((trip) => trip.id));
  const locationError = useWatchLocation(api, sharingIds, foreground);
  const [profile, setProfile] = useState<TravelProfile>();
  const [presetEditing, setPresetEditing] = useState<PlaceKey | 'new'>();
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetError, setPresetError] = useState<string>();
  const [status, setStatus] = useState(apiMode === 'mock' ? '' : 'Connecting…');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [topBarEdge, setTopBarEdge] = useState(0);
  const [here, setHere] = useState<LngLat>();
  const initialLocation = useRef(true);
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
    return () => { active = false; };
  }, [api]);

  useFocusEffect(useCallback(() => {
    let active = true;
    profileSaved().then(() => api.getProfile()).then((loaded) => {
      if (!active || !loaded) return;
      setProfile(loaded);
      if (!edited.current) reset(loaded.defaults);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [api, reset]));

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
    const replan = action.kind === 'update' && action.patch.boarding?.state === 'missed';
    if (replan) setRerouting({ client: api, id: action.id, checkedAt: items.find((item) => item.id === action.id)?.watchStatus?.checkedAt });
    const task = action.kind === 'watch' ? update(action.id, { watch: action.watch }) : action.kind === 'update' ? update(action.id, action.patch) : remove(action.id);
    return task.then(() => true).catch(() => { setTripAction(action); if (replan) setRerouting(undefined); return false; });
  }, [update, remove, api, items]);

  const showRoutes = useCallback(() => {
    closeSaved();
    setFilterField(undefined);
    setFilterSearch(undefined);
    setChatBehind(false);
    setSheet(undefined);
    setResultsOpen(true);
  }, [closeSaved]);

  const filtersToRoutes = useCallback(() => {
    edited.current = true;
    fill({ time: { type: 'departAt', at: new Date().toISOString() } }, 'user');
    showRoutes();
  }, [fill, showRoutes]);

  const applyAgent = useCallback((patch: TripDraftPatch, source: DraftChangeSource) => {
    edited.current = true;
    apply(patch, source);
  }, [apply]);

  const [handedPlan, setHandedPlan] = useState<PlanResponse>();
  const onAgentPlan = useCallback((agent: PlanResponse, draft: TripDraft) => {
    closeSaved();
    setHandedPlan(agent);
    setAgentPlan({ plan: agent, draft });
    setResultsOpen(true);
  }, [closeSaved]);

  const chat = useChatSession(state, applyAgent, onAgentPlan, live.location ?? here);

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
    if (!foreground) return;
    let active = true;
    if (initialLocation.current) {
      initialLocation.current = false;
      void getLastKnownLocation().then((coordinates) => {
        if (active && coordinates) setHere((current) => current ?? coordinates);
      });
    }
    getCurrentPlace().then((result) => {
      if (!active || !result.ok) return;
      setHere(result.place.coordinates);
      setTracking(true);
    }).catch(() => undefined);
    return () => {
      active = false;
      setHere(undefined);
    };
  }, [foreground]);

  const known = live.location ?? here;
  const onLocate = useCallback(async () => {
    if (known) setLocateKey((key) => (key ?? 0) + 1);
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
  }, [editDraft, known]);

  const searchTo = useCallback(async (destination: Place) => {
    const patch: TripDraftPatch = { destination };
    if (!state.draft.time) patch.time = { type: 'departAt', at: new Date().toISOString() };
    const origin = state.draft.origin;
    if (!origin || (origin.coordinates[0] === destination.coordinates[0] && origin.coordinates[1] === destination.coordinates[1])) {
      if (known) {
        patch.origin = currentLocationPlace(known);
      } else {
        setLocating(true);
        const result = await getCurrentPlace();
        setLocating(false);
        if (result.ok) patch.origin = result.place;
      }
    }
    editDraft(patch);
    setResultsOpen(true);
  }, [state.draft.time, state.draft.origin, editDraft, known]);

  const writeProfile = useCallback(async (change: (base: Omit<Partial<TravelProfile>, 'updatedAt'>) => PutProfileRequest) => {
    setPresetSaving(true);
    setPresetError(undefined);
    try {
      await profileSaved();
      const current = await api.getProfile();
      const { updatedAt, ...base } = current ?? ({} as Partial<TravelProfile>);
      void updatedAt;
      const saved = await api.putProfile(change(base));
      setProfile(saved);
      setPresetEditing(undefined);
    } catch {
      setPresetError('Could not save. Try again.');
    } finally {
      setPresetSaving(false);
    }
  }, [api]);

  const savePlace = useCallback((key: PlaceKey | 'new', choice: PresetChoice) => writeProfile((base) => {
    if (key !== 'new' && isPresetKey(key)) {
      const preset = key === 'gym' ? { color: choice.color, icon: choice.icon, place: choice.place ?? base.presets?.gym?.place } : { color: choice.color, icon: choice.icon };
      return { ...base, presets: { ...base.presets, [key]: preset } };
    }
    return { ...base, places: upsertCustomPlace(base.places, key, { ...choice, name: choice.name ?? '' }, newPlaceId()) };
  }), [writeProfile]);

  const deletePlace = useCallback((key: PlaceKey) => writeProfile((base) => ({ ...base, places: removeCustomPlace(base.places, key) })), [writeProfile]);

  const places = useMemo(() => profilePlaces(profile), [profile]);
  const chips = useMemo<SavedPlaceChip[]>(() => places.flatMap(({ place, ...entry }) => (place && entry.key !== 'gym' ? [{
    key: entry.key,
    label: entry.name,
    icon: entry.icon,
    color: entry.color,
    onPress: () => void searchTo(place),
    onEdit: () => {
      setPresetError(undefined);
      setPresetEditing(entry.key);
    }
  }] : [])), [places, searchTo]);
  const addPlace = useMemo(() => ((profile?.places?.length ?? 0) < MAX_CUSTOM_PLACES ? () => {
    setPresetError(undefined);
    setPresetEditing('new');
  } : undefined), [profile]);
  const editing = presetEditing && presetEditing !== 'new' ? places.find((entry) => entry.key === presetEditing) : undefined;

  const closeResults = useCallback(() => {
    setResultsOpen(false);
    setSaveFailed(undefined);
  }, []);

  const openSaved = resultsOpen ? undefined : items.find((item) => item.id === openSavedId);
  const boardingIndex = openSaved?.legs.findIndex((leg, index) => scheduledModes.includes(leg.mode)
    && index > (openSaved.watchStatus?.boardedLegIndex ?? -1)
    && (openSaved.watchStatus?.boardedLegIndex === undefined || now.getTime() >= Date.parse(openSaved.legs[openSaved.watchStatus.boardedLegIndex]!.arriveAt))
    && now.getTime() >= Date.parse(leg.departAt) - 10 * 60_000
    && now.getTime() <= Date.parse(leg.arriveAt) + 15 * 60_000) ?? -1;
  const boardingLeg = openSaved?.legs[boardingIndex];
  const setBoarding = (state: 'boarded' | 'missed') => {
    if (openSaved && boardingLeg) runTripAction({ id: openSaved.id, kind: 'update', patch: { boarding: { legIndex: boardingIndex, tripId: boardingLeg.trip?.tripId ?? boardingLeg.id, state } } });
  };
  const toggleTripLocation = async (enabled: boolean) => {
    if (!openSaved) return;
    const id = openSaved.id;
    if (enabled) {
      const result = await getCurrentPlace();
      if (!result.ok) {
        setNotice('Could not enable trip location. Use the boarding buttons or enable location in Settings.');
        return;
      }
    }
    setSharingTrips((previous) => {
      const next = new Set(previous.client === api ? previous.ids : []);
      if (enabled) next.add(id);
      else next.delete(id);
      return { client: api, ids: next };
    });
  };

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
    editDraft({ origin: state.draft.destination ?? null, destination: state.draft.origin ?? null, stops: state.draft.stops ? [...state.draft.stops].reverse() : null });
  }, [state.draft.origin, state.draft.destination, state.draft.stops, editDraft]);

  const movePlace = useCallback((from: number, to: number) => {
    const patch = movePatch(state.draft, from, to);
    if (patch) editDraft(patch);
  }, [state.draft, editDraft]);

  useEffect(() => {
    if (!requestKey || currentPlan) { clearPlan(); return; }
    void runPlan(JSON.parse(requestKey) as TripRequest);
  }, [requestKey, currentPlan, runPlan, clearPlan]);

  const savedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const savedColors = useMemo(
    () => withPresetColors(new Map(items.flatMap((item) => (item.color ? [[item.id, item.color] as const] : []))), presetTripColors(items, profile)),
    [items, profile]
  );

  const watched = useMemo(() => items.filter((trip) => trip.watch), [items]);
  const handingOff = !chat.pending && chat.progress.phase === 'done' && chat.lastPlan !== undefined && chat.progress.plan === chat.lastPlan && handedPlan !== chat.lastPlan;
  const turnPlan = chat.pending || handingOff ? chat.progress.plan : undefined;
  const buildPreview = useMemo(() => (chat.pending ? agentBuildPreview(chat.progress) : undefined), [chat.pending, chat.progress]);
  const choosing = resultsOpen || turnPlan !== undefined;
  const mapTrips = useMemo<Itinerary[]>(() => {
    if (turnPlan) return [...turnPlan.itineraries, ...turnPlan.nearMisses, ...(turnPlan.returnPlan?.options.map((option) => option.itinerary) ?? [])];
    if (resultsOpen) return [...(plan.data?.itineraries ?? []), ...(plan.data?.nearMisses ?? []), ...(plan.data?.returnPlan?.options.map((option) => option.itinerary) ?? [])];
    return openSaved && !openSaved.watch ? [...watched, openSaved] : watched;
  }, [resultsOpen, plan.data, turnPlan, watched, openSaved]);
  const shownIds = mapTrips.map((it) => it.id).join(' ');
  const savedPlan = useMemo(() => (openSaved ? { data: { itineraries: [openSaved], nearMisses: [], warnings: [] }, loading: false } : undefined), [openSaved]);
  const routeColors = useMemo(() => assignRouteColors(shownIds ? shownIds.split(' ') : [], savedColors), [shownIds, savedColors]);

  const saveResult = useCallback((itinerary: Itinerary, tripRequest: TripRequest) => {
    setSaveFailed(undefined);
    save({ itinerary, request: tripRequest, watch: true, color: placeFor(tripRequest.destination, profile)?.color ?? routeColors.get(itinerary.id) }).catch(() => setSaveFailed({ itinerary, request: tripRequest }));
  }, [save, routeColors, profile]);

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
        unfocusedColors={choosing ? 'mode' : 'trip'}
        variant={choosing ? 'choosing' : 'saved'}
        buildPreview={buildPreview}
        fitKey={`${shownIds}|${resultsOpen || openSaved ? sheetHeight : 'home'}|${openSaved?.id ?? ''}|${openSaved?.request.time.at ?? ''}`}
        fitItineraryId={openSaved?.id}
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
          onMovePlace={movePlace}
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
            status: tripCardText(openSaved, now).message,
            rerouting: (rerouting?.client === api && rerouting.id === openSaved.id) || openSaved.watchStatus?.pendingReplan === true,
            change: openSaved.watchStatus?.change?.message,
            onDismissChange: openSaved.watchStatus?.change ? () => runTripAction({ id: openSaved.id, kind: 'update', patch: { dismissChangeId: openSaved.watchStatus!.change!.id } }) : undefined,
            boardingLabel: openSaved.watch && boardingLeg ? `Are you on ${boardingLeg.routeName ?? boardingLeg.mode}?` : undefined,
            onBoard: () => setBoarding('boarded'),
            onMissed: () => setBoarding('missed'),
            sharingLocation: sharedIds.has(openSaved.id),
            onToggleLocation: (enabled) => void toggleTripLocation(enabled),
            error: tripAction?.id === openSaved.id ? (tripAction.kind !== 'delete' ? 'Could not update this trip. Check your connection and try again.' : 'Could not delete this trip. Check your connection and try again.') : locationError ?? notice,
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
          onAddPlace={addPlace}
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
      {presetEditing === 'new' || editing ? (
        <PresetSheet
          colors={colors}
          label={editing?.name ?? 'New place'}
          value={editing ? { name: editing.name, color: editing.color, icon: editing.icon, place: editing.place } : { name: '', color: nextPlaceColor(profile), icon: 'favorite' }}
          palette={PALETTE}
          icons={PRESET_ICONS}
          placeEditable={!editing || !isPresetKey(editing.key) || editing.key === 'gym'}
          nameEditable={!editing || !isPresetKey(editing.key)}
          near={live.location ?? here}
          saving={presetSaving}
          error={presetError}
          onSave={(choice) => void savePlace(editing?.key ?? 'new', choice)}
          onDelete={editing && !isPresetKey(editing.key) ? () => void deletePlace(editing.key) : undefined}
          onOpenSettings={() => {
            setPresetEditing(undefined);
            navigation.navigate('Settings');
          }}
          onClose={() => setPresetEditing(undefined)}
        />
      ) : null}
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
          defaults={profile?.defaults}
          onClose={!chatBehind && (resultsOpen || state.draft.destination) ? filtersToRoutes : closeSheet}
          onShowRoutes={filtersToRoutes}
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
