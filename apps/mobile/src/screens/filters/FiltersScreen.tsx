import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { formatClockOnDay, type DraftChangeSource, type Place, type PlanResponse, type TravelMode, type TripDraft, type TripDraftPatch } from '@transit/shared';
import { getCurrentPlace } from '../../platform';
import { FiltersChrome } from './FiltersChrome';
import type { LimitCustom } from './limits';
import { canAddStop, movePatch, pickPatch, placeSlots, removeStopPatch, type PlaceTarget } from './places';
import { filtersResetPatch } from './reset';

const CHIP_MODES = ['walk', 'bus', 'rail', 'bike', 'car'] as const;
const WALK_STEPS = [5, 10, 15, 20, 30, 45, 60];
const TRANSFER_STEPS = [0, 1, 2, 3, 4, 5, 6];
const TIME_OPTIONS = [
  { value: 'departAt', label: 'Depart at' },
  { value: 'arriveBy', label: 'Arrive by' }
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
export type LimitKey = 'maxWalkMinutes' | 'maxTransfers';
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
  places: PlaceRowItem[];
  onSearch: (target: PlaceTarget) => void;
  canAddStop: boolean;
  onRemoveStop: (index: number) => void;
  onMovePlace: (from: number, to: number) => void;
  search?: {
    which: PlaceTarget;
    near?: Place['coordinates'];
    locating: boolean;
    notice?: string;
    onPick: (place: Place) => void;
    onUseLocation: () => void;
  };
  time: { label: string; set: boolean; agent: boolean; at?: string };
  timeOptions: { value: TimeType; label: string; selected: boolean }[];
  onTimeType: (type: TimeType) => void;
  onSetTime: (at: Date) => void;
  modes: { mode: ChipMode; label: string; selected: boolean }[];
  modesAgent: boolean;
  onToggleMode: (mode: ChipMode) => void;
  lateOptions: { value: LateTolerance; label: string; selected: boolean }[];
  lateAgent: boolean;
  onLateTolerance: (value: LateTolerance) => void;
  preferences: { key: PreferenceKey; start: string; end: string; value: number; agent: boolean }[];
  onPreference: (key: PreferenceKey, value: number) => void;
  limits: { key: LimitKey; title: string; label: string; agent: boolean; options: { value: number | null; label: string; selected: boolean }[]; custom: LimitCustom }[];
  onLimit: (key: LimitKey, value: number | null) => void;
  stepFree: { on: boolean; agent: boolean };
  onStepFree: (on: boolean) => void;
  counts?: { routes: string; almost: string };
}

export interface PlaceRowItem {
  role: 'origin' | 'stop' | 'destination';
  target: PlaceTarget;
  title: string;
  label: string;
  agent: boolean;
}

export interface FiltersScreenProps {
  draft: TripDraft;
  provenance: Record<string, DraftChangeSource>;
  apply: (patch: TripDraftPatch, source: 'user') => void;
  field?: string;
  plan?: { data?: PlanResponse; loading: boolean };
  startSearch?: 'destination';
  defaults?: TripDraftPatch;
  onClose: () => void;
  onShowRoutes: () => void;
}

function focusFor(field?: string): FilterFocus | undefined {
  if (!field) return undefined;
  if (field === 'origin' || field === 'destination' || field === 'stops' || field === 'time') return 'where';
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

function limitOptions(current: number | undefined, steps: readonly number[], label: (value: number) => string) {
  const values = current === undefined || steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
  return [
    { value: null, label: 'No limit', selected: current === undefined },
    ...values.map((value) => ({ value, label: label(value), selected: value === current }))
  ];
}

function upcoming(picked: Date, now: Date): Date {
  const at = new Date(picked);
  at.setSeconds(0, 0);
  while (at.getTime() < now.getTime() - 60_000) at.setDate(at.getDate() + 1);
  return at;
}

function countCopy(routes: number, almost: number): { routes: string; almost: string } {
  return {
    routes: `${routes} ${routes === 1 ? 'route matches' : 'routes match'}`,
    almost: `${almost} ${almost === 1 ? 'almost works' : 'almost work'}`
  };
}

const MODE_LABELS: Record<ChipMode, string> = { walk: 'Walk', bus: 'Bus', rail: 'Train', bike: 'Bike', car: 'Car' };

export function FiltersScreen({ draft, provenance, apply, field, plan, startSearch, defaults, onClose, onShowRoutes }: FiltersScreenProps) {
  const [limitsOpen, setLimitsOpen] = useState(true);
  const [searching, setSearching] = useState<PlaceTarget | undefined>(startSearch);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string>();
  const live = useRef(true);

  useEffect(() => () => { live.current = false; }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searching !== undefined) { setSearching(undefined); return true; }
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
        if (startSearch && draft.destination && draft.time) onShowRoutes();
        return;
      }
      setNotice(result.reason === 'denied'
        ? 'Location is off for Transit Agent. You can turn it on in Settings.'
        : 'Could not find your location. Try again.');
    });
  };

  const walkLabel = (value: number) => `${value} min`;
  const transferLabel = (value: number) => (value === 0 ? 'No transfers' : String(value));

  const data = plan && !plan.loading ? plan.data : undefined;
  const near = searching === 'origin' ? draft.destination?.coordinates : draft.origin?.coordinates;
  const slots = placeSlots(draft);
  const places: PlaceRowItem[] = slots.map((place, index) => {
    const last = index === slots.length - 1;
    if (index === 0) return { role: 'origin', target: 'origin', title: 'From', label: placeLabel(place), agent: agent('origin') };
    if (last) return { role: 'destination', target: 'destination', title: 'To', label: placeLabel(place), agent: agent('destination') };
    return { role: 'stop', target: index - 1, title: slots.length > 3 ? `Stop ${index}` : 'Stop', label: placeLabel(place), agent: agent('stops') };
  });

  const props: FiltersChromeProps = {
    focus: focusFor(field),
    limitsOpen,
    onToggleLimits: () => setLimitsOpen((open) => !open),
    onClose,
    onReset: () => {
      setSearching(undefined);
      setNotice(undefined);
      apply(filtersResetPatch(draft, defaults, new Date()), 'user');
    },
    onShowRoutes,
    places,
    onSearch: (which) => {
      setNotice(undefined);
      setSearching((current) => current === which ? undefined : which);
    },
    canAddStop: canAddStop(draft),
    onRemoveStop: (index) => {
      setSearching(undefined);
      apply(removeStopPatch(draft, index), 'user');
    },
    onMovePlace: (from, to) => {
      const patch = movePatch(draft, from, to);
      if (!patch) return;
      setSearching(undefined);
      apply(patch, 'user');
    },
    search: searching !== undefined ? {
      which: searching,
      near,
      locating,
      notice,
      onPick: (place) => {
        apply(pickPatch(draft, searching, place), 'user');
        setNotice(undefined);
        const origin = searching === 'origin' ? place : draft.origin;
        const destination = searching === 'destination' ? place : draft.destination;
        if (startSearch && !origin) { setSearching('origin'); return; }
        setSearching(undefined);
        if (startSearch && destination && draft.time) onShowRoutes();
      },
      onUseLocation
    } : undefined,
    time: {
      label: draft.time ? formatClockOnDay(draft.time.at, new Date(), draft.timeZone) : 'Set a time',
      set: draft.time !== undefined,
      agent: agent('time'),
      at: draft.time?.at
    },
    timeOptions: TIME_OPTIONS.map((option) => ({ ...option, selected: option.value === timeType })),
    onTimeType: (type) => {
      const at = draft.time?.at ?? new Date().toISOString();
      if (draft.time?.type === type) return;
      apply({ time: { type, at } }, 'user');
    },
    onSetTime: (picked) => {
      const at = upcoming(picked, new Date()).toISOString();
      if (draft.time?.at === at && draft.time.type === timeType) return;
      apply({ time: { type: timeType, at } }, 'user');
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
    limits: [
      {
        key: 'maxWalkMinutes',
        title: 'Max walk',
        label: draft.constraints.maxWalkMinutes === undefined ? 'No limit' : walkLabel(draft.constraints.maxWalkMinutes),
        agent: agent('constraints.maxWalkMinutes'),
        options: limitOptions(draft.constraints.maxWalkMinutes, WALK_STEPS, walkLabel),
        custom: { suffix: 'min', max: 240, current: draft.constraints.maxWalkMinutes }
      },
      {
        key: 'maxTransfers',
        title: 'Max transfers',
        label: draft.constraints.maxTransfers === undefined ? 'No limit' : transferLabel(draft.constraints.maxTransfers),
        agent: agent('constraints.maxTransfers'),
        options: limitOptions(draft.constraints.maxTransfers, TRANSFER_STEPS, transferLabel),
        custom: { suffix: 'transfers', max: 10, current: draft.constraints.maxTransfers }
      }
    ],
    onLimit: (key, value) => {
      if (value === (draft.constraints[key] ?? null)) return;
      if (key === 'maxWalkMinutes') apply({ constraints: { maxWalkMinutes: value } }, 'user');
      else apply({ constraints: { maxTransfers: value } }, 'user');
    },
    stepFree: { on: draft.constraints.wheelchairAccessible === true, agent: agent('constraints.wheelchairAccessible') },
    onStepFree: (on) => apply({ constraints: { wheelchairAccessible: on ? true : null } }, 'user'),
    counts: data ? countCopy(data.itineraries.length, data.nearMisses.length) : undefined
  };

  return <FiltersChrome {...props} />;
}
