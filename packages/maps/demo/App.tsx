// The demo page: pick a scenario, see its trips on the map, click a route or a card to select it.
// This file plays the app's role: it owns the selection and passes it to <RouteMap>.
import type { Itinerary } from '@transit/shared';
import { useMemo, useState } from 'react';
import { assignRouteColors } from '../src/colors.js';
import { commuteOptions, flightOptions } from '../src/samples.js';
import { RouteMap } from '../src/web/index.js';

const SCENARIOS = {
  ground: { label: 'Transit / drive', about: 'MIT → South Station: the same trip by Red Line, bus or car', trips: commuteOptions },
  flight: { label: 'Flying', about: 'MIT → Orlando: fly from Boston, Providence or Manchester', trips: flightOptions }
} satisfies Record<string, { label: string; about: string; trips: Itinerary[] }>;
type ScenarioId = keyof typeof SCENARIOS;

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron'; // free, no key

const duration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>('ground');
  const [selectedId, setSelectedId] = useState<string>();
  const [lastEvent, setLastEvent] = useState('Click a route on the map.');

  const trips = SCENARIOS[scenario].trips;
  // The app owns the colours: computed once, passed to the map AND used by the cards below.
  const colors = useMemo(() => assignRouteColors(trips.map((t) => t.id)), [trips]);

  const switchTo = (id: ScenarioId) => {
    setScenario(id);
    setSelectedId(undefined);
  };

  return (
    <div className="layout">
      <aside className="panel">
        <h1>Route map demo</h1>
        <p className="muted">@transit/maps · sample routes, no server needed</p>

        <div className="tabs">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button key={id} aria-pressed={scenario === id} onClick={() => switchTo(id)}>
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>
        <p className="muted">{SCENARIOS[scenario].about}</p>

        {trips.map((trip) => (
          <button
            key={trip.id}
            className="card"
            aria-pressed={selectedId === trip.id}
            onClick={() => setSelectedId(selectedId === trip.id ? undefined : trip.id)}
          >
            <span className="swatch" style={{ background: colors.get(trip.id) }} />
            <span>
              <strong>{duration(trip.durationMinutes)} · ${trip.cost.totalUsd.toFixed(2)}</strong>
              <br />
              {trip.summary}
            </span>
          </button>
        ))}

        <p className="muted event">{lastEvent}</p>
      </aside>

      <main className="map">
        <RouteMap
          itineraries={trips}
          selectedItineraryId={selectedId}
          onRouteSelect={(id, candidates) => {
            setSelectedId(id);
            setLastEvent(`onRouteSelect("${id}") · ${candidates.length} route(s) under the click`);
          }}
          routeColors={colors}
          styleUrl={BASEMAP}
          userLocation={[-71.0905, 42.3616]}
          fitKey={scenario}
        />
      </main>
    </div>
  );
}
