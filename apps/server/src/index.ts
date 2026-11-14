import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from './app.js';
import { migrate } from './store/migrations.js';
import { SqliteItineraryStore } from './store/sqlite.js';
import { SqliteProfileStore } from './store/profiles.js';

const databasePath = process.env.DATABASE_PATH ?? './data/transit-agent.db';
if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
migrate(db);
const app = createServer({ itineraries: new SqliteItineraryStore(db), profiles: new SqliteProfileStore(db) });

async function shutdown() {
  try {
    await app.close();
  } finally {
    db.close();
  }
}

let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    shutdown().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3001)
  });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  if (!closing) {
    closing = true;
    await shutdown();
  }
}
