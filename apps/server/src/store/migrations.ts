import type { DatabaseSync } from 'node:sqlite';

const migrations = [
  `CREATE TABLE saved_itineraries (
    device_id TEXT NOT NULL, id TEXT NOT NULL,
    saved_at TEXT NOT NULL, label TEXT, watch INTEGER NOT NULL DEFAULT 1, leave_by TEXT,
    itinerary_json TEXT NOT NULL, request_json TEXT NOT NULL,
    PRIMARY KEY (device_id, id)
  );
  CREATE INDEX saved_itineraries_watch ON saved_itineraries (watch, leave_by);
  CREATE TABLE profiles (device_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, updated_at TEXT NOT NULL);`,
  'ALTER TABLE saved_itineraries ADD COLUMN color TEXT',
  'ALTER TABLE saved_itineraries ADD COLUMN watch_status_json TEXT'
];

export function migrate(db: DatabaseSync): void {
  db.exec('BEGIN');
  try {
    const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    for (let index = version; index < migrations.length; index++) {
      db.exec(migrations[index]!);
      db.exec(`PRAGMA user_version = ${index + 1}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
