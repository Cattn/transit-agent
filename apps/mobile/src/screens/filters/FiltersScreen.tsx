import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { formatClock, type DraftChangeSource, type Place, type PlanResponse, type TravelMode, type TripDraft, type TripDraftPatch } from '@transit/shared';
import { getCurrentPlace } from '../../platform';
import { FiltersChrome } from './FiltersChrome';

const CHIP_MODES = ['walk', 'bus', 'rail', 'bike'] as const;
const WALK_STEPS = [5, 10, 15, 20, 30, 45, 60];
const TRANSFER_STEPS = [0, 1, 2, 3, 4, 5, 6];
const TIME_OPTIONS = [
  { value: 'departAt', label: 'Depart' },
  { value: 'arriveBy', label: 'Arrive' }
] as const;
const LATE_OPTIONS = [
  { value: 'strict', label: 'On time' },
  { value: 'some', label: 'Bit late OK' },
  { value: 'flexible', label: 'Flexible' }
] as const;
const PREFERENCE_ROWS = [
  { key: 'comfortVsCost', start: 'Cheaper', end: 'Comfier' },
  { key: 'transferRisk', start: 'Safe transfers', end: 'Tight' },
  { key: 'activeTravel', start: 'Less walking', end: 'More' }
] as const;

export type FilterFocus = 'where' | 'modes' | 'strict' | 'prefs' | 'limits';
export type ChipMode = (typeof CHIP_MODES)[number];
export type LimitAction = 'down' | 'up' | 'clear';
export type PreferenceKey = (typeof PREFERENCE_ROWS)[number]['key'];
export type TimeType = (typeof TIME_OPTIONS)[number]['value'];
export type LateTolerance = (typeof LATE_OPTIONS)[number]['value'];

export interface FiltersChromeProps {
  focus?: FilterFocus;
  limitsOpen: boolean;
  onToggleLimits: () => void;
  onClose: () => void;
  onReset: () => void;
  onShowRoutes: () => void;
  origin: { label: string; agent: boolean };
  destination: { label: string; agent: boolean };
  onSearch: (which: 'origin' | 'destination') => void;
  search?: {
    which: 'origin' | 'destination';
    near?: Place['coordinates'];
    locating: boolean;
    notice?: string;
    onPick: (place: Place) => void;
    onUseLocation: () => void;
  };
  time: { label: string; set: boolean; agent: boolean };
  timeOptions: { value: TimeType; label: string; selected: boolean }[];
  onTimeType: (type: TimeType) => void;
  onSetTime: () => void;
  modes: { mode: ChipMode; label: string; selected: boolean }[];
  modesAgent: boolean;
  onToggleMode: (mode: ChipMode) => void;
  lateOptions: { value: LateTolerance; label: string; selected: boolean }[];
  lateAgent: boolean;
  onLateTolerance: (value: LateTolerance) => void;
  preferences: { key: PreferenceKey; start: string; end: string; value: number; agent: boolean }[];
  onPreference: (key: PreferenceKey, value: number) => void;
  walk: { label: string; set: boolean; agent: boolean };
  transfers: { label: string; set: boolean; agent: boolean };
  onWalk: (action: LimitAction) => void;
  onTransfers: (action: LimitAction) => void;
  stepFree: { on: boolean; agent: boolean };
  onStepFree: (on: boolean) => void;
  counts?: { routes: string; almost: string };
}

export interface FiltersScreenProps {
  draft: TripDraft;
  provenance: Record<string, DraftChangeSource>;
  apply: (patch: TripDraftPatch, source: 'user') => void;
  field?: string;
  plan?: { data?: PlanResponse; loading: boolean };
  onClose: () => void;
  onShowRoutes: () => void;
}

function focusFor(field?: string): FilterFocus | undefined {
  if (!field) return undefined;
  if (field === 'origin' || field === 'destination' || field === 'time') return 'where';
  if (field === 'modes') return 'modes';
  if (field === 'preferences.lateTolerance') return 'strict';
  if (field.startsWith('preferences.')) return 'prefs';
  if (field.startsWith('constraints.')) return 'limits';
  return undefined;
}

function placeLabel(place: Place | undefined): string {
  if (!place) return 'Choose a place';
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

function stepLimit(current: number | undefined, delta: 1 | -1, steps: readonly number[], start: number): number | null | undefined {
  if (current === undefined) return delta > 0 ? start : undefined;
  if (delta > 0) return steps.find((step) => step > current) ?? current;
  let lower: number | undefined;
  for (const step of steps) if (step < current) lower = step;
  return lower ?? null;
}

function countCopy(routes: number, almost: number): { routes: string; almost: string } {
  return {
    routes: `${routes} ${routes === 1 ? 'route matches' : 'routes match'}`,
    almost: `${almost} ${almost === 1 ? 'almost works' : 'almost work'}`
  };
}

const MODE_LABELS: Record<ChipMode, string> = { walk: 'Walk', bus: 'Bus', rail: 'Train', bike: 'Bike' };

export function FiltersScreen({ draft, provenance, apply, field, plan, onClose, onShowRoutes }: FiltersScreenProps) {
  const [limitsOpen, setLimitsOpen] = useState(() => field?.startsWith('constraints.') ?? false);
  const [searching, setSearching] = useState<'origin' | 'destination'>();
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const live = useRef(true);

  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searching) { setSearching(undefined); return true; }
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [searching, onClose]);

  const agent = (key: string) => provenance[key] === 'agent';
  const timeType: TimeType = draft.time?.type ?? 'departAt';

  const onUseLocation = () => {
    setLocating(true);
    setNotice(undefined);
    void getCurrentPlace().then((result) => {
      if (!live.current) return;
      setLocating(false);
      if (result.ok) {
        apply({ origin: result.place }, 'user');
        setSearching(undefined);
        return;
      }
      setNotice(result.reason === 'denied'
        ? 'Location is off for Transit Agent. You can turn it on in Settings.'
        : 'Could not find your location. Try again.');
    });
  };

  const onLimit = (key: 'maxWalkMinutes' | 'maxTransfers', current: number | undefined, action: LimitAction, steps: readonly number[], start: number) => {
    const next = action === 'clear'
      ? (current === undefined ? undefined : null)
      : stepLimit(current, action === 'up' ? 1 : -1, steps, start);
    if (next === undefined) return;
    if (key === 'maxWalkMinutes') apply({ constraints: { maxWalkMinutes: next } }, 'user');
    else apply({ constraints: { maxTransfers: next } }, 'user');
  };

  const data = plan && !plan.loading ? plan.data : undefined;
  const near = searching === 'destination' ? draft.origin?.coordinates : draft.destination?.coordinates;

  const props: FiltersChromeProps = {
    focus: focusFor(field),
    limitsOpen,
    onToggleLimits: () => setLimitsOpen((open) => !open),
    onClose,
    onReset: () => apply({
      modes: ['walk', 'bus', 'rail'],
      preferences: { comfortVsCost: 0.5, transferRisk: 0.3, lateTolerance: 'some', activeTravel: 0.5 },
      constraints: {
        arriveBy: null,
        maxBudgetUsd: null,
        maxWalkMinutes: null,
        maxBikeMinutes: null,
        maxTransfers: null,
        minTransferBufferMinutes: null,
        maxDriveMinutes: null,
        wheelchairAccessible: null
      }
    }, 'user'),
    onShowRoutes,
    origin: { label: placeLabel(draft.origin), agent: agent('origin') },
    destination: { label: placeLabel(draft.destination), agent: agent('destination') },
    onSearch: (which) => {
      setNotice(undefined);
      setSearching((current) => current === which ? undefined : which);
    },
    search: searching ? {
      which: searching,
      near,
      locating,
      notice,
      onPick: (place) => {
        apply(searching === 'origin' ? { origin: place } : { destination: place }, 'user');
        setSearching(undefined);
        setNotice(undefined);
      },
      onUseLocation
    } : undefined,
    time: {
      label: draft.time ? formatClock(draft.time.at, draft.timeZone) : 'Set a time',
      set: draft.time !== undefined,
      agent: agent('time')
    },
    timeOptions: TIME_OPTIONS.map((option) => ({ ...option, selected: option.value === timeType })),
    onTimeType: (type) => {
      const at = draft.time?.at ?? new Date().toISOString();
      if (draft.time?.type === type) return;
      apply({ time: { type, at } }, 'user');
    },
    onSetTime: () => {
      if (draft.time) return;
      apply({ time: { type: 'departAt', at: new Date().toISOString() } }, 'user');
    },
    modes: CHIP_MODES.map((mode) => ({ mode, label: MODE_LABELS[mode], selected: draft.modes.includes(mode) })),
    modesAgent: agent('modes'),
    onToggleMode: (mode) => {
      const next = toggleMode(draft.modes, mode);
      if (next) apply({ modes: next }, 'user');
    },
    lateOptions: LATE_OPTIONS.map((option) => ({ ...option, selected: option.value === draft.preferences.lateTolerance })),
    lateAgent: agent('preferences.lateTolerance'),
    onLateTolerance: (value) => apply({ preferences: { lateTolerance: value } }, 'user'),
    preferences: PREFERENCE_ROWS.map((row) => ({ ...row, value: draft.preferences[row.key], agent: agent(`preferences.${row.key}`) })),
    onPreference: (key, value) => {
      const next = Math.min(1, Math.max(0, Math.round(value * 100) / 100));
      if (key === 'comfortVsCost') apply({ preferences: { comfortVsCost: next } }, 'user');
      else if (key === 'transferRisk') apply({ preferences: { transferRisk: next } }, 'user');
      else apply({ preferences: { activeTravel: next } }, 'user');
    },
    walk: {
      label: draft.constraints.maxWalkMinutes === undefined ? 'No limit' : `${draft.constraints.maxWalkMinutes} min`,
      set: draft.constraints.maxWalkMinutes !== undefined,
      agent: agent('constraints.maxWalkMinutes')
    },
    transfers: {
      label: draft.constraints.maxTransfers === undefined ? 'No limit' : String(draft.constraints.maxTransfers),
      set: draft.constraints.maxTransfers !== undefined,
      agent: agent('constraints.maxTransfers')
    },
    onWalk: (action) => onLimit('maxWalkMinutes', draft.constraints.maxWalkMinutes, action, WALK_STEPS, 15),
    onTransfers: (action) => onLimit('maxTransfers', draft.constraints.maxTransfers, action, TRANSFER_STEPS, 1),
    stepFree: { on: draft.constraints.wheelchairAccessible === true, agent: agent('constraints.wheelchairAccessible') },
    onStepFree: (on) => apply({ constraints: { wheelchairAccessible: on ? true : null } }, 'user'),
    counts: data ? countCopy(data.itineraries.length, data.nearMisses.length) : undefined
  };

  return <FiltersChrome {...props} />;
}
