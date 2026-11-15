import type { AgentProgressEvent } from '../domain/agent.js';
import type { PlanResponse } from '../domain/api.js';
import type { Place } from '../domain/places.js';

export type AgentProgressPhase = 'idle' | 'thinking' | 'locating' | 'searching' | 'routes' | 'done' | 'error';

export interface AgentProgress {
  phase: AgentProgressPhase;
  candidates: Place[];
  origin?: Place;
  destination?: Place;
  plan?: PlanResponse;
  lastSeq: number;
}

export const initialAgentProgress: AgentProgress = { phase: 'idle', candidates: [], lastSeq: -1 };

export function reduceAgentProgress(state: AgentProgress, event: AgentProgressEvent): AgentProgress {
  if (event.seq <= state.lastSeq) return state;
  const next = { ...state, lastSeq: event.seq };
  switch (event.type) {
    case 'thinking':
      return { ...next, phase: 'thinking' };
    case 'places':
      return { ...next, phase: 'locating', candidates: event.places };
    case 'draft': {
      const { origin, destination } = event.draft;
      return { ...next, origin, destination, candidates: origin && destination ? [] : next.candidates };
    }
    case 'searching':
      return { ...next, phase: 'searching', origin: event.origin, destination: event.destination, candidates: [] };
    case 'routes':
      return { ...next, phase: 'routes', plan: event.plan };
    case 'done':
      return { ...next, phase: 'done', plan: event.response.plan ?? next.plan };
    case 'error':
      return { ...next, phase: 'error' };
    default:
      return next;
  }
}
