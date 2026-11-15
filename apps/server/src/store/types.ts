import type { Itinerary, SavedItinerary, SaveItineraryRequest, TripRequest, UpdateItineraryRequest, WatchStatus } from '@transit/shared';

export interface ItineraryStore {
  list(deviceId: string): Promise<SavedItinerary[]>;
  get(deviceId: string, id: string): Promise<SavedItinerary | undefined>;
  /** id = itinerary.id; re-saving the same id overwrites. */
  save(deviceId: string, input: SaveItineraryRequest): Promise<SavedItinerary>;
  update(deviceId: string, id: string, patch: UpdateItineraryRequest): Promise<SavedItinerary | undefined>;
  remove(deviceId: string, id: string): Promise<boolean>;
}

export interface WatchedItinerary {
  deviceId: string;
  item: SavedItinerary;
}

export interface WatchUpdate {
  itinerary: Itinerary;
  request: TripRequest;
  watchStatus: WatchStatus;
  previousStatus?: WatchStatus;
}

export interface WatchStore {
  listWatched(activeAfterIso: string, departBeforeIso: string): Promise<WatchedItinerary[]>;
  applyWatch(deviceId: string, id: string, update: WatchUpdate): Promise<SavedItinerary | undefined>;
}

