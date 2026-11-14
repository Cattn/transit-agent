import assert from 'node:assert/strict';
import { createServer } from '../apps/server/dist/app.js';

const app = createServer();

try {
  const health = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, 'ok');

  const sections = await app.inject({ method: 'GET', url: '/api/sections' });
  assert.equal(sections.statusCode, 200);
  assert.deepEqual(sections.json().map((section) => section.id), ['flight', 'commute', 'biking', 'agent']);

  const cors = await app.inject({
    method: 'OPTIONS',
    url: '/api/health',
    headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' }
  });
  assert.equal(cors.headers['access-control-allow-origin'], 'http://localhost:5173');

  const plan = await app.inject({
    method: 'POST',
    url: '/api/plan',
    payload: {
      origin: { name: 'Boston Common', coordinates: [-71.0656, 42.355], kind: 'poi' },
      destination: { name: 'Harvard Square', coordinates: [-71.119, 42.3736], kind: 'poi' },
      time: { type: 'departAt', at: '2026-11-16T08:00:00-05:00' },
      modes: ['walk', 'bus', 'rail', 'bike', 'car'],
      vehicles: { ownsBike: true, ownsCar: true }
    }
  });
  assert.equal(plan.statusCode, 200);
  assert.ok(plan.json().itineraries.length > 0);
  console.log('API smoke checks passed.');
} finally {
  await app.close();
}
