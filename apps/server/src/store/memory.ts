import type { SavedItinerary, SaveItineraryRequest } from '@transit/shared';
import type { ItineraryStore } from './types.js';

/** Process-local store (lost on restart). Plan 005 adds a SQLite implementation of the same interface. */
export class MemoryItineraryStore implements ItineraryStore {
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
    patch: { label?: string; watch?: boolean }
  ): Promise<SavedItinerary | undefined> {
    const items = this.byDevice.get(deviceId);
    const current = items?.get(id);
    if (!items || !current) return undefined;
    const next: SavedItinerary = { ...current };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.watch !== undefined) next.watch = patch.watch;
    items.set(id, next);
    return structuredClone(next);
  }

  async remove(deviceId: string, id: string): Promise<boolean> {
    return this.byDevice.get(deviceId)?.delete(id) ?? false;
  }
}
