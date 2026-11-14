import { useMemo } from 'react';
import {
  describePatch,
  formatAge,
  formatClock,
  itineraryFreshness,
  type ApiClientError,
  type DraftState,
  type Itinerary,
  type PlanResponse,
  type Place,
  type TripConstraints,
  type TripRequest,
  type toTripRequest
} from '@transit/shared';
import type { AppColors } from '../../theme/colors';
import { itineraryCardText, nearMissText, type ItineraryCardText, type NearMissText } from './ItineraryCard';
import { ResultsChrome } from './ResultsChrome';

const LEAVE_NOW_MS = 2 * 60_000;

export interface ResultChip {
  key: string;
  label: string;
  kind: 'time' | 'agent';
}

export interface ResultCard {
  id: string;
  text: ItineraryCardText;
  selected: boolean;
  saved: boolean;
}

export interface ResultsChromeProps {
  colors: AppColors;
  origin: string;
  destination: string;
  chips: ResultChip[];
  title: string;
  subtitle: string;
  updated?: string;
  live: boolean;
  warning?: string;
  message?: string;
  cards: ResultCard[];
  nearMisses: (NearMissText & { id: string })[];
  canSave: boolean;
  onSelect: (id: string) => void;
  onSave: (id: string) => void;
  onBack: () => void;
  onSwap: () => void;
  onOpenFilters: () => void;
  onSheetLayout: (height: number) => void;
}

export interface ResultsScreenProps {
  colors: AppColors;
  draftState: DraftState;
  request: ReturnType<typeof toTripRequest>;
  plan: { data?: PlanResponse; error?: ApiClientError; loading: boolean };
  now: Date;
  savedIds: ReadonlySet<string>;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  onSave: (itinerary: Itinerary, request: TripRequest) => void;
  onBack: () => void;
  onSwap: () => void;
  onOpenFilters: () => void;
  onSheetLayout: (height: number) => void;
}

function placeLabel(place: Place | undefined, fallback: string): string {
  return place?.name ?? fallback;
}

function timeLabel(state: DraftState, now: Date): string | undefined {
  const time = state.draft.time;
  if (!time) return undefined;
  if (time.type === 'arriveBy') return `Arrive by ${formatClock(time.at, state.draft.timeZone)}`;
  if (Math.abs(Date.parse(time.at) - now.getTime()) < LEAVE_NOW_MS) return 'Leave now';
  return `Leave at ${formatClock(time.at, state.draft.timeZone)}`;
}

function resultChips(state: DraftState, now: Date): ResultChip[] {
  const chips: ResultChip[] = [];
  const time = timeLabel(state, now);
  if (time) chips.push({ key: 'time', label: time, kind: 'time' });
  const constraints = state.draft.constraints as TripConstraints;
  for (const [key, value] of Object.entries(constraints)) {
    if (value === undefined) continue;
    const line = describePatch({ constraints: { [key]: value } })[0];
    if (!line) continue;
    const agent = state.provenance[`constraints.${key}`] === 'agent';
    chips.push({ key, label: agent ? `Agent: ${line}` : line, kind: agent ? 'agent' : 'time' });
  }
  return chips;
}

export function ResultsScreen(props: ResultsScreenProps) {
  const { draftState, request, now, selectedId, onSelect } = props;
  const { data, error, loading } = props.plan;

  const timeZone = request.ok ? request.request.timeZone : undefined;
  const itineraries = useMemo(() => data?.itineraries ?? [], [data]);
  const nearMisses = data?.nearMisses ?? [];

  let message: string | undefined;
  if (!request.ok) message = 'Add where and when';
  else if (error) message = error.code === 'network' ? 'You are offline' : error.message;
  else if (loading || !data) message = 'Finding routes…';
  else if (!itineraries.length && !nearMisses.length) message = data.warnings[0] ?? 'No routes found';

  const oldest = itineraries.reduce<string | undefined>((min, it) => (!min || it.source.fetchedAt < min ? it.source.fetchedAt : min), undefined);
  const arriveBy = draftState.draft.constraints.arriveBy;
  const subtitle = [timeLabel(draftState, now), arriveBy ? `arrive by ${formatClock(arriveBy, timeZone)}` : undefined].filter(Boolean).join(' · ');

  const chrome: ResultsChromeProps = {
    colors: props.colors,
    origin: placeLabel(draftState.draft.origin, 'Choose start'),
    destination: placeLabel(draftState.draft.destination, 'Choose destination'),
    chips: resultChips(draftState, now),
    title: data && !message ? `${itineraries.length} ${itineraries.length === 1 ? 'route' : 'routes'}` : 'Routes',
    subtitle,
    updated: oldest && !message ? `updated ${formatAge(oldest, now)}` : undefined,
    live: itineraries.some((it) => itineraryFreshness(it).label === 'Live'),
    warning: message ? undefined : data?.warnings[0],
    message,
    cards: message ? [] : itineraries.map((it) => ({
      id: it.id,
      text: itineraryCardText(it, now, timeZone),
      selected: it.id === selectedId,
      saved: props.savedIds.has(it.id)
    })),
    nearMisses: message ? [] : nearMisses.map((it) => ({ id: it.id, ...nearMissText(it, timeZone) })),
    canSave: request.ok,
    onSelect: (id) => onSelect(id === selectedId ? undefined : id),
    onSave: (id) => {
      const itinerary = itineraries.find((it) => it.id === id);
      if (itinerary && request.ok) props.onSave(itinerary, request.request);
    },
    onBack: props.onBack,
    onSwap: props.onSwap,
    onOpenFilters: props.onOpenFilters,
    onSheetLayout: props.onSheetLayout
  };

  return <ResultsChrome {...chrome} />;
}
