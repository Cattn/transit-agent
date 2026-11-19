export type SectionId = 'flight' | 'commute' | 'biking' | 'agent';

export interface Section {
  id: SectionId;
  title: string;
  description: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
}

export const sections: readonly Section[] = [
  { id: 'flight', title: 'Flight', description: 'Compare airports, fares, and the time it takes to get there.' },
  { id: 'commute', title: 'Commute', description: 'Find when to leave and which transfers are worth the risk.' },
  { id: 'biking', title: 'Biking', description: 'Mix bikes and transit to make the whole trip faster.' },
  { id: 'agent', title: 'Agent', description: 'Plan a trip around your preferences without doing all the research.' }
];

export * from './domain/modes.js';
export * from './domain/places.js';
export * from './domain/trip-draft.js';
export * from './domain/itinerary.js';
export * from './domain/stops.js';
export * from './domain/watch.js';
export * from './domain/api.js';
export * from './domain/fixtures.js';
export * from './domain/agent.js';
export * from './domain/place-search.js';
export * from './format/format.js';
export * from './theme/colors.js';
export * from './theme/contrast.js';
export * from './client/api-client.js';
export * from './client/device-id.js';
export * from './client/trip-draft-state.js';
export * from './client/agent-progress.js';
export { createMockApiClient, type MockScenario, type MockApiClientOptions } from './client/mock/mock-client.js';
export * from './domain/profile.js';
