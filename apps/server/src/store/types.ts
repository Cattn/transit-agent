import type { SavedItinerary, SaveItineraryRequest } from '@transit/shared';

export interface ItineraryStore {
  list(deviceId: string): Promise<SavedItinerary[]>;
  get(deviceId: string, id: string): Promise<SavedItinerary | undefined>;
  /** id = itinerary.id; re-saving the same id overwrites. */
  save(deviceId: string, input: SaveItineraryRequest): Promise<SavedItinerary>;
  update(deviceId: string, id: string, patch: { label?: string; watch?: boolean }): Promise<SavedItinerary | undefined>;
  remove(deviceId: string, id: string): Promise<boolean>;
}
