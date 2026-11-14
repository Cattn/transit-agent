import { useCallback, useMemo, useReducer } from 'react';
import { applyDraftPatch, initialDraftState, toTripRequest, type DraftState, type TripDraftPatch, type DraftChangeSource } from '@transit/shared';

type Action = { patch: TripDraftPatch; source: DraftChangeSource } | { defaults?: TripDraftPatch } | { state: DraftState };

function reduce(state: DraftState, action: Action): DraftState {
  if ('state' in action) return action.state;
  try {
    return 'patch' in action ? applyDraftPatch(state, action.patch, action.source) : initialDraftState(action.defaults);
  } catch (error) {
    console.warn('Invalid trip draft patch', error);
    return state;
  }
}

export function useTripDraft(defaults?: TripDraftPatch) {
  const [state, dispatch] = useReducer(reduce, defaults, initialDraftState);
  const apply = useCallback((patch: TripDraftPatch, source: DraftChangeSource) => dispatch({ patch, source }), []);
  const reset = useCallback((defaults?: TripDraftPatch) => dispatch({ defaults }), []);
  const restore = useCallback((state: DraftState) => dispatch({ state }), []);
  const request = useMemo(() => toTripRequest(state.draft), [state.draft]);
  return { state, apply, reset, restore, request };
}
