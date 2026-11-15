import { applyWatchAction, ItinerarySchema, type SavedItinerary, type SaveItineraryRequest, type UpdateItineraryRequest } from '@transit/shared';
import type { ItineraryStore, WatchedItinerary, WatchStore, WatchUpdate } from './types.js';

/** Process-local store (lost on restart). Plan 005 adds a SQLite implementation of the same interface. */
export class MemoryItineraryStore implements ItineraryStore, WatchStore {
  private readonly byDevice = new Map<string, Map<string, SavedItinerary>>();

  private device(deviceId: string): Map<string, SavedItinerary> {
    let items = this.byDevice.get(deviceId);
    if (!items) {
      items = new Map();
      this.byDevice.set(deviceId, items);
    }
    return items;
  }

  async list(deviceId: string): Promise<SavedItinerary[]> {
    return [...(this.byDevice.get(deviceId)?.values() ?? [])].map((item) => structuredClone(item));
  }

  async get(deviceId: string, id: string): Promise<SavedItinerary | undefined> {
    const item = this.byDevice.get(deviceId)?.get(id);
    return item && structuredClone(item);
  }

  async save(deviceId: string, input: SaveItineraryRequest): Promise<SavedItinerary> {
    const saved: SavedItinerary = {
      ...structuredClone(input.itinerary),
      savedAt: new Date().toISOString(),
      watch: input.watch,
      request: structuredClone(input.request)
    };
    if (input.label !== undefined) saved.label = input.label;
    const color = this.device(deviceId).get(saved.id)?.color ?? input.color;
    if (color !== undefined) saved.color = color;
    this.device(deviceId).set(saved.id, saved);
    return structuredClone(saved);
  }

  async update(
    deviceId: string,
    id: string,
    patch: UpdateItineraryRequest
  ): Promise<SavedItinerary | undefined> {
    const items = this.byDevice.get(deviceId);
    const current = items?.get(id);
    if (!items || !current) return undefined;
    const next: SavedItinerary = { ...current };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.watch !== undefined) next.watch = patch.watch;
    next.watchStatus = applyWatchAction(current, patch);
    items.set(id, next);
    return structuredClone(next);
  }

  async remove(deviceId: string, id: string): Promise<boolean> {
    return this.byDevice.get(deviceId)?.delete(id) ?? false;
  }

  async listWatched(activeAfterIso: string, departBeforeIso: string): Promise<WatchedItinerary[]> {
    const activeAfter = Date.parse(activeAfterIso);
    const departBefore = Date.parse(departBeforeIso);
    return [...this.byDevice].flatMap(([deviceId, items]) => [...items.values()]
      .filter((item) => item.watch && Math.max(Date.parse(item.arriveAt), ...item.legs.map((leg) => Date.parse(leg.arriveAt))) >= activeAfter && Date.parse(item.departAt) <= departBefore)
      .map((item) => ({ deviceId, item: structuredClone(item) })));
  }

  async applyWatch(deviceId: string, id: string, update: WatchUpdate): Promise<SavedItinerary | undefined> {
    const items = this.byDevice.get(deviceId);
    const current = items?.get(id);
    if (!items || !current) return undefined;
    if (Object.hasOwn(update, 'previousStatus') && (!current.watch || JSON.stringify(current.watchStatus) !== JSON.stringify(update.previousStatus))) return undefined;
    const next: SavedItinerary = {
      ...structuredClone(ItinerarySchema.parse(update.itinerary)),
      id,
      savedAt: current.savedAt,
      watch: current.watch,
      request: structuredClone(update.request),
      watchStatus: structuredClone(update.watchStatus)
    };
    if (update.watchStatus.leaveBy !== undefined) next.leaveBy = update.watchStatus.leaveBy;
    if (current.label !== undefined) next.label = current.label;
    if (current.color !== undefined) next.color = current.color;
    items.set(id, next);
    return structuredClone(next);
  }
}
