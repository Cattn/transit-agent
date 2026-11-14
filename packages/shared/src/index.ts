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

export function createApiClient(baseUrl: string) {
  const url = baseUrl.replace(/\/$/, '');

  async function get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${url}${path}`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`API request failed (${response.status})`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    health: () => get<HealthResponse>('/api/health'),
    sections: () => get<Section[]>('/api/sections')
  };
}
