import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MAX_CUSTOM_PLACES, PRESET_ICONS, initialDraftState, type Place, type PresetIcon, type PutProfileRequest, type TravelMode, type TravelProfile, type TripDraftPatch } from '@transit/shared';
import { PALETTE, nextPlaceColor, presetColor, presetIcon, profilePlaces, removeCustomPlace, upsertCustomPlace, type PlaceKey as ProfilePlaceKey } from '@transit/maps';
import { useApi, useDeviceId } from '@transit/client-react';
import { getApiUrl, getCurrentPlace, removeServer, secureStoreDeviceIdStorage, setServerUrl, useSavedServers, useServerUrl } from '../../platform';
import { apiMode, buildMode } from '../../data/client';
import { useAppColors, useAppearance, type AppearancePreference } from '../../theme/appearance';
import packageJson from '../../../package.json';
import { PresetSheet } from '../home/PresetSheet';
import { newPlaceId } from '../home/place-id';
import { SettingsChrome } from './SettingsChrome';

const CHIP_MODES = ['walk', 'bus', 'rail', 'bike', 'car'] as const;
const MODE_LABELS: Record<ChipMode, string> = { walk: 'Walk', bus: 'Bus', rail: 'Train', bike: 'Bike', car: 'Car' };
const WALK_STEPS = [5, 10, 15, 20, 30, 45, 60];
const TRANSFER_STEPS = [0, 1, 2, 3, 4, 5, 6];
const LATE_OPTIONS = [
  { value: 'strict', label: 'Must be on time' },
  { value: 'some', label: 'A little late is OK' },
  { value: 'flexible', label: 'Flexible' }
] as const;
const THEME_OPTIONS = [
  { value: 'system', label: 'System (light / dark)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
] as const;
const SERVICE_ZONE = 'America/New_York';
const START_ZONE_LABEL = "Trip's starting point";
const HEALTH_TIMEOUT_MS = 5000;

export type ChipMode = (typeof CHIP_MODES)[number];
export type PlaceKey = 'home' | 'work';
export type LimitKey = 'maxWalkMinutes' | 'maxTransfers';
export type LateTolerance = (typeof LATE_OPTIONS)[number]['value'];

export interface Choice<T> {
  value: T;
  label: string;
  selected: boolean;
}

export interface SettingsChromeProps {
  ready: boolean;
  loadError?: string;
  onRetryLoad: () => void;
  saveError?: string;
  onBack: () => void;
  places: { key: PlaceKey; title: string; value: string; icon: PresetIcon; color: string }[];
  editingPlace?: PlaceKey;
  onEditPlace: (key: PlaceKey | undefined) => void;
  customPlaces: { key: ProfilePlaceKey; title: string; value: string; icon: PresetIcon; color: string }[];
  onEditCustomPlace: (key: ProfilePlaceKey) => void;
  onAddPlace?: () => void;
  placeLimit: number;
  placeSearch: {
    near?: Place['coordinates'];
    locating: boolean;
    notice?: string;
    onPick: (place: Place) => void;
    onUseLocation: () => void;
  };
  modes: { mode: ChipMode; label: string; selected: boolean }[];
  onToggleMode: (mode: ChipMode) => void;
  comfort: number;
  onComfort: (value: number) => void;
  limits: { key: LimitKey; title: string; label: string; options: Choice<number | null>[] }[];
  onLimit: (key: LimitKey, value: number | null) => void;
  late: { label: string; options: Choice<LateTolerance>[] };
  onLateTolerance: (value: LateTolerance) => void;
  stepFree: boolean;
  onStepFree: (on: boolean) => void;
  carMpg?: number;
  carMpgLabel: string;
  onCarMpg: (value: number | undefined) => void;
  timeZone: { label: string; options: Choice<string | null>[] };
  onTimeZone: (value: string | null) => void;
  theme: { label: string; options: Choice<AppearancePreference>[] };
  onTheme: (value: AppearancePreference) => void;
  server: { label: string; saved: string | null; loading: boolean; servers: { url: string; label: string }[]; defaultLabel: string };
  onCheckServer: (url: string) => Promise<boolean>;
  onSaveServer: (url: string | null) => void;
  onRemoveServer: (url: string) => void;
  deviceId: string;
  version: string;
}

type Profile = Omit<TravelProfile, 'updatedAt'>;

const EMPTY: Profile = { defaults: {} };

let profileSaves: Promise<void> = Promise.resolve();

export function profileSaved(): Promise<void> {
  return profileSaves;
}

function placeName(place: Place): string {
  return place.name ?? `${place.coordinates[1].toFixed(4)}, ${place.coordinates[0].toFixed(4)}`;
}

function toggleMode(modes: readonly TravelMode[], mode: ChipMode): TravelMode[] | undefined {
  const has = modes.includes(mode);
  if (has && modes.length === 1) return undefined;
  const next = has ? modes.filter((item) => item !== mode) : [...modes, mode];
  const chips = CHIP_MODES.filter((item) => next.includes(item));
  const rest = next.filter((item) => !(CHIP_MODES as readonly string[]).includes(item));
  return [...chips, ...rest];
}

function limitOptions(current: number | undefined, steps: readonly number[], label: (value: number) => string): Choice<number | null>[] {
  const values = current === undefined || steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
  return [
    { value: null, label: 'No limit', selected: current === undefined },
    ...values.map((value) => ({ value, label: label(value), selected: value === current }))
  ];
}

function mergeDefaults(defaults: TripDraftPatch, patch: TripDraftPatch): TripDraftPatch {
  const next: TripDraftPatch = { ...defaults, ...patch };
  if (patch.constraints) next.constraints = { ...defaults.constraints, ...patch.constraints };
  if (patch.preferences) next.preferences = { ...defaults.preferences, ...patch.preferences };
  if (patch.vehicles) next.vehicles = { ...defaults.vehicles, ...patch.vehicles };
  return next;
}

function deviceZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function shortId(id: string | undefined): string {
  if (!id) return 'Loading…';
  const short = id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
  return `${short} · stored on this phone`;
}

function withoutScheme(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
}

function serverLabel(saved: string | null | undefined): string {
  if (saved === undefined) return 'Loading…';
  if (saved) return withoutScheme(getApiUrl(saved));
  if (apiMode === 'mock') return 'Sample data (no server)';
  return `${withoutScheme(getApiUrl(null))} (default)`;
}

function defaultServerLabel(): string {
  return buildMode === 'mock' ? 'Sample data (no server)' : `${withoutScheme(getApiUrl(null))} (default)`;
}

async function reachServer(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const api = useApi();
  const deviceId = useDeviceId(secureStoreDeviceIdStorage);
  const { preference, setPreference } = useAppearance();
  const serverUrl = useServerUrl();
  const savedServers = useSavedServers();
  const [profile, setProfile] = useState<Profile>();
  const [loadError, setLoadError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [loadKey, setLoadKey] = useState(0);
  const [editingPlace, setEditingPlace] = useState<PlaceKey>();
  const [placeSheet, setPlaceSheet] = useState<ProfilePlaceKey | 'new'>();
  const colors = useAppColors();
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const saved = useRef<Profile>(EMPTY);
  const desired = useRef<Profile>(EMPTY);
  const locationRequest = useRef(0);
  const generation = useRef(0);
  const live = useRef(true);
  const [profileApi, setProfileApi] = useState(api);
  if (profileApi !== api) {
    setProfileApi(api);
    setProfile(undefined);
    setLoadError(undefined);
    setSaveError(undefined);
    setEditingPlace(undefined);
    setPlaceSheet(undefined);
    setLocating(false);
    setNotice(undefined);
  }

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    locationRequest.current += 1;
    saved.current = EMPTY;
    desired.current = EMPTY;
    profileSaved().then(() => api.getProfile()).then((loaded) => {
      if (!active) return;
      const next: Profile = loaded ? { displayName: loaded.displayName, home: loaded.home, work: loaded.work, defaults: loaded.defaults, presets: loaded.presets, places: loaded.places } : EMPTY;
      saved.current = next;
      desired.current = next;
      setProfile(next);
    }).catch(() => {
      if (active) setLoadError('Could not load your profile. Check your connection and try again.');
    });
    return () => { active = false; };
  }, [api, loadKey]);

  const cancelLocation = useCallback(() => {
    locationRequest.current += 1;
    setLocating(false);
  }, []);

  useEffect(() => {
    if (!editingPlace) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelLocation();
      setEditingPlace(undefined);
      return true;
    });
    return () => subscription.remove();
  }, [editingPlace, cancelLocation]);

  const save = useCallback((change: (current: Profile) => Profile) => {
    const next = change(desired.current);
    desired.current = next;
    setProfile(next);
    setSaveError(undefined);
    const gen = generation.current;
    const body: PutProfileRequest = next;
    profileSaves = profileSaves.then(async () => {
      if (gen !== generation.current) return;
      try {
        await api.putProfile(body);
        saved.current = next;
      } catch {
        if (gen !== generation.current) return;
        generation.current += 1;
        desired.current = saved.current;
        if (!live.current) return;
        setProfile(saved.current);
        setSaveError('Could not save that change. Check your connection and try again.');
      }
    });
  }, [api]);

  const saveDefaults = useCallback((patch: TripDraftPatch) => {
    save((current) => ({ ...current, defaults: mergeDefaults(current.defaults, patch) }));
  }, [save]);

  const pickPlace = useCallback((key: PlaceKey, place: Place) => {
    cancelLocation();
    setEditingPlace(undefined);
    setNotice(undefined);
    save((current) => ({ ...current, [key]: place }));
  }, [save, cancelLocation]);

  const draft = useMemo(() => {
    try {
      return initialDraftState(profile?.defaults).draft;
    } catch {
      return initialDraftState().draft;
    }
  }, [profile?.defaults]);

  const zone = profile?.defaults.timeZone ?? undefined;
  const carMpg = profile?.defaults.vehicles?.carMpg;
  const local = deviceZone();
  const zoneChoices = [...new Set([SERVICE_ZONE, ...(local ? [local] : []), ...(zone ? [zone] : [])])];
  const walkLabel = (value: number) => `${value} min`;
  const transferLabel = (value: number) => (value === 0 ? 'No transfers' : String(value));
  const lateLabel = LATE_OPTIONS.find((option) => option.value === draft.preferences.lateTolerance)?.label ?? '';
  const themeLabel = THEME_OPTIONS.find((option) => option.value === preference)?.label ?? '';

  const retryLoad = () => {
    if (!loadError) return;
    setLoadError(undefined);
    setLoadKey((key) => key + 1);
  };

  const props: SettingsChromeProps = {
    ready: profile !== undefined,
    loadError,
    onRetryLoad: () => {
      setLoadError(undefined);
      setLoadKey((key) => key + 1);
    },
    saveError,
    onBack: () => navigation.goBack(),
    places: [
      { key: 'home', title: 'Home', value: profile?.home ? placeName(profile.home) : 'Not set', icon: presetIcon('home', profile), color: presetColor('home', profile) },
      { key: 'work', title: 'Work', value: profile?.work ? placeName(profile.work) : 'Not set', icon: presetIcon('office', profile), color: presetColor('office', profile) }
    ],
    editingPlace,
    customPlaces: profilePlaces(profile).filter((entry) => entry.key.startsWith('place:')).map((entry) => ({
      key: entry.key,
      title: entry.name,
      value: entry.place ? placeName(entry.place) : 'Not set',
      icon: entry.icon,
      color: entry.color
    })),
    onEditCustomPlace: (key) => setPlaceSheet(key),
    onAddPlace: (profile?.places?.length ?? 0) < MAX_CUSTOM_PLACES ? () => setPlaceSheet('new') : undefined,
    placeLimit: MAX_CUSTOM_PLACES,
    onEditPlace: (key) => {
      cancelLocation();
      setNotice(undefined);
      setEditingPlace((current) => (current === key ? undefined : key));
    },
    placeSearch: {
      near: (editingPlace === 'home' ? profile?.work : profile?.home)?.coordinates,
      locating,
      notice,
      onPick: (place) => { if (editingPlace) pickPlace(editingPlace, place); },
      onUseLocation: () => {
        const key = editingPlace;
        if (!key) return;
        const request = ++locationRequest.current;
        setLocating(true);
        setNotice(undefined);
        void getCurrentPlace().then((result) => {
          if (!live.current || request !== locationRequest.current) return;
          setLocating(false);
          if (result.ok) pickPlace(key, result.place);
          else setNotice(result.reason === 'denied' ? 'Location is off for Transit Agent. You can turn it on in Settings.' : 'Could not find your location. Try again.');
        });
      }
    },
    modes: CHIP_MODES.map((mode) => ({ mode, label: MODE_LABELS[mode], selected: draft.modes.includes(mode) })),
    onToggleMode: (mode) => {
      const next = toggleMode(draft.modes, mode);
      if (next) saveDefaults({ modes: next });
    },
    comfort: draft.preferences.comfortVsCost,
    onComfort: (value) => {
      const next = Math.min(1, Math.max(0, Math.round(value * 100) / 100));
      if (next !== draft.preferences.comfortVsCost) saveDefaults({ preferences: { comfortVsCost: next } });
    },
    limits: [
      {
        key: 'maxWalkMinutes',
        title: 'Max walk',
        label: draft.constraints.maxWalkMinutes === undefined ? 'No limit' : walkLabel(draft.constraints.maxWalkMinutes),
        options: limitOptions(draft.constraints.maxWalkMinutes, WALK_STEPS, walkLabel)
      },
      {
        key: 'maxTransfers',
        title: 'Max transfers',
        label: draft.constraints.maxTransfers === undefined ? 'No limit' : transferLabel(draft.constraints.maxTransfers),
        options: limitOptions(draft.constraints.maxTransfers, TRANSFER_STEPS, transferLabel)
      }
    ],
    onLimit: (key, value) => {
      if (value === (draft.constraints[key] ?? null)) return;
      saveDefaults({ constraints: key === 'maxWalkMinutes' ? { maxWalkMinutes: value } : { maxTransfers: value } });
    },
    late: {
      label: lateLabel,
      options: LATE_OPTIONS.map((option) => ({ ...option, selected: option.value === draft.preferences.lateTolerance }))
    },
    onLateTolerance: (value) => {
      if (value !== draft.preferences.lateTolerance) saveDefaults({ preferences: { lateTolerance: value } });
    },
    stepFree: draft.constraints.wheelchairAccessible === true,
    onStepFree: (on) => saveDefaults({ constraints: { wheelchairAccessible: on ? true : null } }),
    carMpg,
    carMpgLabel: carMpg === undefined ? 'Not set' : `${carMpg} mpg`,
    onCarMpg: (value) => {
      if (value === carMpg) return;
      save((current) => {
        const vehicles = { ...current.defaults.vehicles };
        if (value === undefined) delete vehicles.carMpg;
        else vehicles.carMpg = value;
        return { ...current, defaults: { ...current.defaults, vehicles } };
      });
    },
    timeZone: {
      label: zone ?? START_ZONE_LABEL,
      options: [
        { value: null, label: START_ZONE_LABEL, selected: zone === undefined },
        ...zoneChoices.map((value) => ({ value, label: value, selected: value === zone }))
      ]
    },
    onTimeZone: (value) => {
      if (value === (zone ?? null)) return;
      saveDefaults({ timeZone: value });
    },
    theme: {
      label: themeLabel,
      options: THEME_OPTIONS.map((option) => ({ ...option, selected: option.value === preference }))
    },
    onTheme: setPreference,
    server: {
      label: serverLabel(serverUrl),
      saved: serverUrl ?? null,
      loading: serverUrl === undefined || savedServers === undefined,
      servers: (savedServers ?? []).map((url) => ({ url, label: withoutScheme(url) })),
      defaultLabel: defaultServerLabel()
    },
    onCheckServer: reachServer,
    onSaveServer: (url) => {
      retryLoad();
      void setServerUrl(url);
    },
    onRemoveServer: (url) => {
      if (url === serverUrl) retryLoad();
      void removeServer(url);
    },
    deviceId: shortId(deviceId),
    version: packageJson.version
  };

  const sheetPlace = placeSheet && placeSheet !== 'new' ? profilePlaces(profile).find((entry) => entry.key === placeSheet) : undefined;
  const closeSheet = () => setPlaceSheet(undefined);

  return (
    <>
      <SettingsChrome {...props} />
      {placeSheet === 'new' || sheetPlace ? (
        <PresetSheet
          colors={colors}
          label={sheetPlace?.name ?? 'New place'}
          value={sheetPlace ? { name: sheetPlace.name, color: sheetPlace.color, icon: sheetPlace.icon, place: sheetPlace.place } : { name: '', color: nextPlaceColor(profile), icon: 'favorite' }}
          palette={PALETTE}
          icons={PRESET_ICONS}
          placeEditable
          nameEditable
          near={profile?.home?.coordinates}
          saving={false}
          onSave={(choice) => {
            const key = sheetPlace?.key ?? 'new';
            const id = newPlaceId();
            save((current) => ({ ...current, places: upsertCustomPlace(current.places, key, { ...choice, name: choice.name ?? '' }, id) }));
            closeSheet();
          }}
          onDelete={sheetPlace ? () => {
            const key = sheetPlace.key;
            save((current) => ({ ...current, places: removeCustomPlace(current.places, key) }));
            closeSheet();
          } : undefined}
          onOpenSettings={closeSheet}
          onClose={closeSheet}
        />
      ) : null}
    </>
  );
}
