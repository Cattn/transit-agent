import type { DatabaseSync, StatementSync } from 'node:sqlite';
import { TravelProfileSchema, type TravelProfile } from '@transit/shared';

export interface ProfileStore {
  get(deviceId: string): Promise<TravelProfile | undefined>;
  put(deviceId: string, profile: TravelProfile): Promise<TravelProfile>;
}

export class MemoryProfileStore implements ProfileStore {
  private readonly profiles = new Map<string, TravelProfile>();

  async get(deviceId: string): Promise<TravelProfile | undefined> {
    const profile = this.profiles.get(deviceId);
    return profile && structuredClone(profile);
  }

  async put(deviceId: string, profile: TravelProfile): Promise<TravelProfile> {
    this.profiles.set(deviceId, structuredClone(profile));
    return structuredClone(profile);
  }
}

export class SqliteProfileStore implements ProfileStore {
  private readonly select: StatementSync;
  private readonly upsert: StatementSync;

  constructor(db: DatabaseSync) {
    this.select = db.prepare('SELECT profile_json, updated_at FROM profiles WHERE device_id = ?');
    this.upsert = db.prepare(`INSERT INTO profiles (device_id, profile_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at`);
  }

  async get(deviceId: string): Promise<TravelProfile | undefined> {
    const row = this.select.get(deviceId);
    if (!row) return undefined;
    try {
      return TravelProfileSchema.parse({ ...JSON.parse(String(row.profile_json)), updatedAt: row.updated_at });
    } catch (error) {
      console.error('Skipping invalid travel profile', deviceId, error);
      return undefined;
    }
  }

  async put(deviceId: string, profile: TravelProfile): Promise<TravelProfile> {
    this.upsert.run(deviceId, JSON.stringify(profile), profile.updatedAt);
    return structuredClone(profile);
  }
}
