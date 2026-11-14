import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { SavedItinerarySchema, type SavedItinerary, type SaveItineraryRequest } from '@transit/shared';
import type { ItineraryStore } from './types.js';

export class SqliteItineraryStore implements ItineraryStore {
  private readonly select: StatementSync;
  private readonly selectOne: StatementSync;
  private readonly upsert: StatementSync;
  private readonly patch: StatementSync;
  private readonly deleteOne: StatementSync;
  private readonly watched: StatementSync;

  constructor(db: DatabaseSync) {
    this.select = db.prepare('SELECT * FROM saved_itineraries WHERE device_id = ? ORDER BY rowid');
    this.selectOne = db.prepare('SELECT * FROM saved_itineraries WHERE device_id = ? AND id = ?');
    this.upsert = db.prepare(`INSERT INTO saved_itineraries
      (device_id, id, saved_at, label, watch, leave_by, itinerary_json, request_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, id) DO UPDATE SET saved_at = excluded.saved_at,
      label = excluded.label, watch = excluded.watch, leave_by = excluded.leave_by,
      itinerary_json = excluded.itinerary_json, request_json = excluded.request_json`);
    this.patch = db.prepare('UPDATE saved_itineraries SET label = ?, watch = ? WHERE device_id = ? AND id = ?');
    this.deleteOne = db.prepare('DELETE FROM saved_itineraries WHERE device_id = ? AND id = ?');
    this.watched = db.prepare('SELECT * FROM saved_itineraries WHERE watch = 1');
  }

  private read(row: Record<string, unknown>): SavedItinerary | undefined {
    try {
      return SavedItinerarySchema.parse({
        ...JSON.parse(String(row.itinerary_json)),
        id: row.id,
        savedAt: row.saved_at,
        ...(row.label === null ? {} : { label: row.label }),
        watch: row.watch === 1,
        ...(row.leave_by === null ? {} : { leaveBy: row.leave_by }),
        request: JSON.parse(String(row.request_json))
      });
    } catch (error) {
      console.error('Skipping invalid saved itinerary', row.id, error);
      return undefined;
    }
  }

  async list(deviceId: string): Promise<SavedItinerary[]> {
    return this.select.all(deviceId).flatMap((row) => this.read(row) ?? []);
  }

  async get(deviceId: string, id: string): Promise<SavedItinerary | undefined> {
    const row = this.selectOne.get(deviceId, id);
    return row && this.read(row);
  }

  async save(deviceId: string, input: SaveItineraryRequest): Promise<SavedItinerary> {
    const saved: SavedItinerary = {
      ...structuredClone(input.itinerary),
      savedAt: new Date().toISOString(),
      watch: input.watch,
      request: structuredClone(input.request)
    };
    if (input.label !== undefined) saved.label = input.label;
    this.upsert.run(deviceId, saved.id, saved.savedAt, saved.label ?? null,
      Number(saved.watch), null, JSON.stringify(input.itinerary), JSON.stringify(input.request));
    return saved;
  }

  async update(deviceId: string, id: string, patch: { label?: string; watch?: boolean }): Promise<SavedItinerary | undefined> {
    const current = await this.get(deviceId, id);
    if (!current) return undefined;
    const next = { ...current };
    if (patch.label !== undefined) next.label = patch.label;
    if (patch.watch !== undefined) next.watch = patch.watch;
    this.patch.run(next.label ?? null, Number(next.watch), deviceId, id);
    return next;
  }

  async remove(deviceId: string, id: string): Promise<boolean> {
    return this.deleteOne.run(deviceId, id).changes > 0;
  }

  async listWatched(nowIso: string, horizonIso: string): Promise<SavedItinerary[]> {
    const now = Date.parse(nowIso);
    const horizon = Date.parse(horizonIso);
    return this.watched.all().flatMap((row) => {
      const item = this.read(row);
      if (!item) return [];
      const departure = Date.parse(item.departAt);
      return departure >= now && departure <= horizon ? [item] : [];
    });
  }
}
