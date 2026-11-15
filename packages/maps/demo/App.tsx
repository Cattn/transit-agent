// The demo page: pick a scenario, see its trips on the map, click a route or a card to select it.
// This file plays the app's role: it owns the selection and passes it to <RouteMap>.
import type { Itinerary, LngLat } from '@transit/shared';
import { useEffect, useMemo, useState } from 'react';
import { assignRouteColors } from '../src/colors.js';
import type { BuildPreview } from '../src/contract.js';
import { commuteOptions, flightOptions } from '../src/samples.js';
import { RouteMap } from '../src/web/index.js';

const SCENARIOS = {
  ground: { label: 'Transit / drive', about: 'MIT → South Station: the same trip by Red Line, bus or car', trips: commuteOptions },
  flight: { label: 'Flying', about: 'MIT → Orlando: fly from Boston, Providence or Manchester', trips: flightOptions },
  building: { label: 'Agent building', about: 'The agent finds MIT and South Station, searches, then the routes draw in', trips: commuteOptions }
} satisfies Record<string, { label: string; about: string; trips: Itinerary[] }>;
type ScenarioId = keyof typeof SCENARIOS;

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron'; // free, no key

const MIT = commuteOptions[0]!.legs[0]!.geometry.coordinates[0] as LngLat;
const SOUTH_STATION = commuteOptions[0]!.legs.at(-1)!.geometry.coordinates.at(-1) as LngLat;
const BUILD_STEPS: BuildPreview[] = [
  { phase: 'locating', origin: MIT, candidates: [[-71.0553, 42.3519], [-71.0577, 42.3489]] },
  { phase: 'searching', origin: MIT, destination: SOUTH_STATION },
  { phase: 'drawing', origin: MIT, destination: SOUTH_STATION }
];
const BUILD_STEP_MS = 1000;

const duration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>('ground');
  const [selectedId, setSelectedId] = useState<string>();
  const [lastEvent, setLastEvent] = useState('Click a route on the map.');
  const [buildStep, setBuildStep] = useState(0);
  const [replays, setReplays] = useState(0);

  useEffect(() => {
    if (scenario !== 'building') return;
    const timers = BUILD_STEPS.slice(1).map((_, i) => setTimeout(() => setBuildStep(i + 1), (i + 1) * BUILD_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [scenario, replays]);

  const building = scenario === 'building';
  const drawn = !building || buildStep === BUILD_STEPS.length - 1;
  const trips = drawn ? SCENARIOS[scenario].trips : [];
  // The app owns the colours: computed once, passed to the map AND used by the cards below.
  const colors = useMemo(() => assignRouteColors(trips.map((t) => t.id)), [trips]);

  const switchTo = (id: ScenarioId) => {
    setScenario(id);
    setSelectedId(undefined);
    setBuildStep(0);
  };

  const replay = () => {
    setSelectedId(undefined);
    setBuildStep(0);
    setReplays((n) => n + 1);
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
        {building && (
          <div className="tabs">
            <button onClick={replay}>Replay · agent is {BUILD_STEPS[buildStep]!.phase}</button>
          </div>
        )}

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
          fitKey={building ? `${scenario}-${replays}-${drawn}` : scenario}
          buildPreview={building ? BUILD_STEPS[buildStep] : undefined}
        />
      </main>
    </div>
  );
}
