import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { applyWatchAction, ItinerarySchema, SavedItinerarySchema, type SavedItinerary, type SaveItineraryRequest, type UpdateItineraryRequest } from '@transit/shared';
import type { ItineraryStore, WatchedItinerary, WatchStore, WatchUpdate } from './types.js';

export class SqliteItineraryStore implements ItineraryStore, WatchStore {
  private readonly select: StatementSync;
  private readonly selectOne: StatementSync;
  private readonly upsert: StatementSync;
  private readonly patch: StatementSync;
  private readonly deleteOne: StatementSync;
  private readonly watched: StatementSync;
  private readonly watchUpdate: StatementSync;

  constructor(db: DatabaseSync) {
    this.select = db.prepare('SELECT * FROM saved_itineraries WHERE device_id = ? ORDER BY rowid');
    this.selectOne = db.prepare('SELECT * FROM saved_itineraries WHERE device_id = ? AND id = ?');
    this.upsert = db.prepare(`INSERT INTO saved_itineraries
      (device_id, id, saved_at, label, watch, leave_by, itinerary_json, request_json, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, id) DO UPDATE SET saved_at = excluded.saved_at,
      label = excluded.label, watch = excluded.watch, leave_by = excluded.leave_by,
      itinerary_json = excluded.itinerary_json, request_json = excluded.request_json, watch_status_json = NULL,
      color = COALESCE(saved_itineraries.color, excluded.color)`);
    this.patch = db.prepare('UPDATE saved_itineraries SET label = COALESCE(?, label), watch = COALESCE(?, watch), watch_status_json = ? WHERE device_id = ? AND id = ?');
    this.deleteOne = db.prepare('DELETE FROM saved_itineraries WHERE device_id = ? AND id = ?');
    this.watched = db.prepare('SELECT * FROM saved_itineraries WHERE watch = 1 ORDER BY rowid');
    this.watchUpdate = db.prepare(`UPDATE saved_itineraries SET itinerary_json = ?, request_json = ?, leave_by = ?, watch_status_json = ?
      WHERE device_id = ? AND id = ?`);
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
        ...(row.watch_status_json === null || row.watch_status_json === undefined ? {} : { watchStatus: JSON.parse(String(row.watch_status_json)) }),
        ...(row.color === null || row.color === undefined ? {} : { color: row.color }),
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
      Number(saved.watch), null, JSON.stringify(input.itinerary), JSON.stringify(input.request), input.color ?? null);
    const row = this.selectOne.get(deviceId, saved.id);
    return (row && this.read(row)) ?? saved;
  }

  async update(deviceId: string, id: string, patch: UpdateItineraryRequest): Promise<SavedItinerary | undefined> {
    const currentRow = this.selectOne.get(deviceId, id);
    const current = currentRow && this.read(currentRow);
    if (!current) return undefined;
    const status = applyWatchAction(current, patch);
    this.patch.run(patch.label ?? null, patch.watch === undefined ? null : Number(patch.watch), status ? JSON.stringify(status) : null, deviceId, id);
    const row = this.selectOne.get(deviceId, id);
    return row && this.read(row);
  }

  async remove(deviceId: string, id: string): Promise<boolean> {
    return this.deleteOne.run(deviceId, id).changes > 0;
  }

  async listWatched(activeAfterIso: string, departBeforeIso: string): Promise<WatchedItinerary[]> {
    const activeAfter = Date.parse(activeAfterIso);
    const departBefore = Date.parse(departBeforeIso);
    return this.watched.all().flatMap((row) => {
      const item = this.read(row);
      if (!item) return [];
      return Math.max(Date.parse(item.arriveAt), ...item.legs.map((leg) => Date.parse(leg.arriveAt))) >= activeAfter && Date.parse(item.departAt) <= departBefore ? [{ deviceId: String(row.device_id), item }] : [];
    });
  }

  async applyWatch(deviceId: string, id: string, update: WatchUpdate): Promise<SavedItinerary | undefined> {
    if (Object.hasOwn(update, 'previousStatus')) {
      const currentRow = this.selectOne.get(deviceId, id);
      const current = currentRow && this.read(currentRow);
      if (!current?.watch || JSON.stringify(current.watchStatus) !== JSON.stringify(update.previousStatus)) return undefined;
    }
    const itinerary = ItinerarySchema.parse(update.itinerary);
    const changes = this.watchUpdate.run(JSON.stringify(itinerary), JSON.stringify(update.request),
      update.watchStatus.leaveBy ?? null, JSON.stringify(update.watchStatus), deviceId, id).changes;
    if (changes === 0) return undefined;
    const row = this.selectOne.get(deviceId, id);
    return row && this.read(row);
  }
}
