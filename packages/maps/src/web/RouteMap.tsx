/**
 * The web renderer (plan 009 step 6): react-map-gl + MapLibre GL JS.
 *
 * This is a thin adapter. All the logic lives in the pure layer (to-geojson, layers, bounds);
 * this file only connects it to react-map-gl's components:
 *   <Map>    : the map itself (basemap tiles, pan/zoom, mouse events)
 *   <Source> : a dataset the map can draw (our GeoJSON)
 *   <Layer>  : how to draw a source (our routeLayers()); must be a child of its <Source>
 *   <Marker> : an HTML element pinned to a coordinate (the location dot)
 * Docs: https://visgl.github.io/react-map-gl/docs/get-started
 *
 * Rule from plan 009: the map never fetches, saves, or owns the selection. It only reports clicks
 * through onRouteSelect; the APP decides what is selected and passes it back as selectedItineraryId.
 * Where routes overlap, tapping the same spot again cycles through them (nextRouteToSelect).
 *
 * Setup the APP must do once at startup (see demo/main.tsx and the README):
 *   - import 'maplibre-gl/dist/maplibre-gl.css'
 *   - setWorkerUrl(...) for MapLibre v6, or the map stays blank
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Layer, Map, Marker, Source, type LayerProps, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { boundsOf, nextRouteToSelect, uniqueItineraryIds } from '../bounds.js';
import type { RouteMapProps } from '../contract.js';
import {
  DEFAULT_ACCENT_COLOR,
  END_ICON_ID,
  HIT_LINE_WIDTH,
  interactiveLayerIds,
  POINT_SOURCE_ID,
  ROUTE_SOURCE_ID,
  routeLayers,
  TOUCH_HIT_LINE_WIDTH,
  type RouteLayer
} from '../layers.js';
import { itinerariesToFeatures, itineraryPoints, transitLegLabels } from '../to-geojson.js';
import { addEndIcon } from './end-icon.js';
import { LegBubble } from './LegBubble.js';

/** Where the camera starts before the first fit (central Boston). */
const INITIAL_VIEW = { longitude: -71.075, latitude: 42.359, zoom: 13.5 };
const DEFAULT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const LEG_BUBBLE_ROOM = 48;
const COARSE_POINTER = '(pointer: coarse)';
const ROUTE_TAP_ZOOM_PAUSE_MS = 600;
const LOCATE_MIN_ZOOM = 15;
const LOCATION_BLUE = '#2563eb';

function subscribeToPointer(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const isTouchScreen = () => window.matchMedia(COARSE_POINTER).matches;
const isTouchScreenOnServer = () => false;

/**
 * Turn one of our layer objects into props for react-map-gl's <Layer>.
 * We drop `source` because a <Layer> nested inside a <Source> gets its source from the parent.
 * The cast is needed because our RouteLayer type is deliberately loose (plain JSON shared with
 * native), while <Layer> wants MapLibre's exact types.
 */
function toLayerProps(layer: RouteLayer): LayerProps {
  const props: Partial<RouteLayer> = { ...layer };
  delete props.source;
  return props as LayerProps;
}

export function RouteMap({
  itineraries,
  selectedItineraryId,
  onRouteSelect,
  onDeselect,
  visibleModes,
  styleUrl,
  userLocation,
  userHeading,
  locateKey,
  fitKey,
  padding = DEFAULT_PADDING,
  routeColors,
  unfocusedColors = 'grey',
  variant = 'saved',
  accentColor
}: RouteMapProps) {
  // A handle on the underlying map so we can call camera methods like fitBounds().
  const mapRef = useRef<MapRef>(null);
  // Is the mouse over a clickable route right now? Drives the cursor.
  const [hoveringRoute, setHoveringRoute] = useState(false);
  const zoomPause = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(zoomPause.current), []);

  const pauseDoubleTapZoom = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.doubleClickZoom.disable();
    clearTimeout(zoomPause.current);
    zoomPause.current = setTimeout(() => map.doubleClickZoom.enable(), ROUTE_TAP_ZOOM_PAUSE_MS);
  };
  // Trips → GeoJSON (only recomputed when one of the inputs changes).
  const lines = useMemo(
    () => itinerariesToFeatures(itineraries, { selectedItineraryId: selectedItineraryId, visibleModes, colors: routeColors }),
    [itineraries, selectedItineraryId, visibleModes, routeColors]
  );
  const points = useMemo(
    () => itineraryPoints(itineraries, { selectedItineraryId: selectedItineraryId, visibleModes, colors: routeColors }),
    [itineraries, selectedItineraryId, visibleModes, routeColors]
  );

  // The layer definitions never change, so build them once.
  const touchScreen = useSyncExternalStore(subscribeToPointer, isTouchScreen, isTouchScreenOnServer);
  const layers = useMemo(
    () =>
      routeLayers({
        hitLineWidth: touchScreen ? TOUCH_HIT_LINE_WIDTH : HIT_LINE_WIDTH,
        unfocused: unfocusedColors,
        variant,
        accentColor
      }),
    [touchScreen, unfocusedColors, variant, accentColor]
  );
  const legLabels = useMemo(() => {
    if (variant !== 'choosing') return [];
    const selected = itineraries.find((it) => it.id === selectedItineraryId);
    return selected ? transitLegLabels(selected) : [];
  }, [variant, itineraries, selectedItineraryId]);
  const lineLayers = layers.filter((layer) => layer.source === ROUTE_SOURCE_ID);
  const pointLayers = layers.filter((layer) => layer.source === POINT_SOURCE_ID);
  const clickableLayerIds = useMemo(() => interactiveLayerIds(), []);

  // Zoom the camera so every visible route fits on screen.
  const handleLoad = () => {
    const map = mapRef.current?.getMap();
    if (map) {
      addEndIcon(map);
      map.on('styleimagemissing', (event: { id: string }) => {
        if (event.id === END_ICON_ID) addEndIcon(map);
      });
    }
    fitToRoutes();
  };

  const panToUser = useEffectEvent(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.easeTo({ center: userLocation, zoom: Math.max(map.getZoom(), LOCATE_MIN_ZOOM), padding, duration: 600 });
  });

  useEffect(() => {
    if (locateKey !== undefined) panToUser();
  }, [locateKey]);

  const fitToRoutes = () => {
    const bounds = boundsOf(itineraries, visibleModes);
    if (!bounds) return; // nothing visible (e.g. the Fly tab with no flights): leave the camera alone
    const room = variant === 'choosing' ? LEG_BUBBLE_ROOM : 0;
    const fitPadding = { ...padding, left: padding.left + room, right: padding.right + room };
    mapRef.current?.fitBounds(bounds, { padding: fitPadding, maxZoom: 16, duration: 600 });
  };

  // Re-fit whenever the APP changes fitKey (e.g. new search results, the "Re-fit camera" button, a tab change).
  // Deliberately NOT when the selection changes: clicking a route shouldn't move the camera under your mouse.
  useEffect(() => {
    fitToRoutes();
    // fitToRoutes reads the latest itineraries/visibleModes itself; fitKey is the only trigger we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // A click on the map. Because of `interactiveLayerIds` below, e.features contains only the
  // features of the invisible wide hit layer under the pointer (possibly several legs from
  // several overlapping trips).
  const handleClick = (event: MapLayerMouseEvent) => {
    const ids = uniqueItineraryIds(event.features ?? []); // topmost trip first, no duplicates
    const next = nextRouteToSelect(ids, selectedItineraryId, itineraries.map((it) => it.id));
    if (next !== undefined) {
      pauseDoubleTapZoom();
      onRouteSelect(next, ids);
    } else if (selectedItineraryId !== undefined) {
      onDeselect?.();
    }
    // ids.length === 0: clicked empty map, nothing else to do
  };

  return (
    <Map
      ref={mapRef}
      mapStyle={styleUrl} // basemap chosen by the app (decision D8)
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      onLoad={handleLoad} // first fit, once the map is ready (the effect above may run before that)
      // Only these layers report clicks/hover. Not the white casing, not the dots.
      interactiveLayerIds={clickableLayerIds}
      onClick={handleClick}
      // onMouseEnter/Leave fire when the pointer enters/leaves a feature in interactiveLayerIds.
      onMouseEnter={() => setHoveringRoute(true)}
      onMouseLeave={() => setHoveringRoute(false)}
      cursor={hoveringRoute ? 'pointer' : 'grab'}
    >
      {/* The routes. When `lines` changes, react-map-gl updates the source and MapLibre redraws. */}
      <Source id={ROUTE_SOURCE_ID} type="geojson" data={lines}>
        {lineLayers.map((layer) => (
          <Layer key={layer.id} {...toLayerProps(layer)} />
        ))}
      </Source>

      {/* Start, end and transfer dots. This source comes second, so its layers draw on top of the lines. */}
      <Source id={POINT_SOURCE_ID} type="geojson" data={points}>
        {pointLayers.map((layer) => (
          <Layer key={layer.id} {...toLayerProps(layer)} />
        ))}
      </Source>

      {/* "You are here". A <Marker> is plain HTML positioned on the map, so normal inline styles work. */}
      {userLocation && (
        <Marker
          longitude={userLocation[0]}
          latitude={userLocation[1]}
          rotation={userHeading ?? 0}
          rotationAlignment="map"
          pitchAlignment="map"
        >
          <svg width={64} height={64} viewBox="-32 -32 64 64" aria-label="You are here" role="img" style={{ overflow: 'visible' }}>
            {userHeading !== undefined && (
              <path d="M0 0 L-15 -27 A31 31 0 0 1 15 -27 Z" fill={LOCATION_BLUE} fillOpacity={0.25} />
            )}
            <circle r={10} fill="#ffffff" style={{ filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.35))' }} />
            <circle r={7} fill={LOCATION_BLUE} />
          </svg>
        </Marker>
      )}

      {legLabels.map((label) => (
        <Marker key={label.legId} longitude={label.coordinates[0]} latitude={label.coordinates[1]} anchor="center">
          <LegBubble mode={label.mode} text={label.text} color={accentColor ?? DEFAULT_ACCENT_COLOR} />
        </Marker>
      ))}
    </Map>
  );
}
