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
 * The one piece of UI the map does own is the overlap picker (RoutePicker.tsx), because it has to
 * appear at the click position on the map.
 *
 * Setup the APP must do once at startup (see demo/main.tsx and the README):
 *   - import 'maplibre-gl/dist/maplibre-gl.css'
 *   - setWorkerUrl(...) for MapLibre v6, or the map stays blank
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Map, Marker, Source, type LayerProps, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { boundsOf, uniqueItineraryIds } from '../bounds.js';
import { assignRouteColors } from '../colors.js';
import type { RouteMapProps } from '../contract.js';
import { interactiveLayerIds, POINT_SOURCE_ID, ROUTE_SOURCE_ID, routeLayers, type RouteLayer } from '../layers.js';
import { itinerariesToFeatures, itineraryPoints } from '../to-geojson.js';
import type { Itinerary } from '@transit/shared';
import { RoutePicker } from './RoutePicker.js';

/** Where the camera starts before the first fit (central Boston). */
const INITIAL_VIEW = { longitude: -71.075, latitude: 42.359, zoom: 13.5 };
const DEFAULT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

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
  visibleModes,
  styleUrl,
  userLocation,
  fitKey,
  padding = DEFAULT_PADDING
}: RouteMapProps) {
  // A handle on the underlying map so we can call camera methods like fitBounds().
  const mapRef = useRef<MapRef>(null);
  // Is the mouse over a clickable route right now? Drives the cursor.
  const [hoveringRoute, setHoveringRoute] = useState(false);
  // Overlap picker as last opened: where, which trips it offers, and which trips/tab were on the map
  // at the time (null = closed).
  const [openedPicker, setOpenedPicker] = useState<{
    longitude: number;
    latitude: number;
    ids: string[];
    forItineraries: Itinerary[];
    forModes: RouteMapProps['visibleModes'];
  } | null>(null);
  // The trip being hovered in the picker. While set, it's drawn as if selected (a live preview).
  const [previewId, setPreviewId] = useState<string | null>(null);

  // The picker only counts as open while the map still shows the same trips and tab it was opened
  // for. Worked out during render (no effect needed): new results or another tab close it.
  const picker =
    openedPicker && openedPicker.forItineraries === itineraries && openedPicker.forModes === visibleModes
      ? openedPicker
      : null;

  // What to draw as selected: the picker preview wins, otherwise the app's real selection.
  // This only changes the drawing; the app's selection doesn't change until you actually pick.
  const shownSelectedId = (picker ? previewId : null) ?? selectedItineraryId;

  // Trips → GeoJSON (only recomputed when one of the inputs changes).
  const lines = useMemo(
    () => itinerariesToFeatures(itineraries, { selectedItineraryId: shownSelectedId, visibleModes }),
    [itineraries, shownSelectedId, visibleModes]
  );
  const points = useMemo(
    () => itineraryPoints(itineraries, { selectedItineraryId: shownSelectedId, visibleModes }),
    [itineraries, shownSelectedId, visibleModes]
  );

  const closePicker = useCallback(() => {
    setOpenedPicker(null);
    setPreviewId(null);
  }, []);

  // The layer definitions never change, so build them once.
  const layers = useMemo(() => routeLayers(), []);
  const lineLayers = layers.filter((layer) => layer.source === ROUTE_SOURCE_ID);
  const pointLayers = layers.filter((layer) => layer.source === POINT_SOURCE_ID);
  const clickableLayerIds = useMemo(() => interactiveLayerIds(), []);

  // Zoom the camera so every visible route fits on screen.
  const fitToRoutes = () => {
    const bounds = boundsOf(itineraries, visibleModes);
    if (!bounds) return; // nothing visible (e.g. the Fly tab with no flights): leave the camera alone
    mapRef.current?.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 });
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
    closePicker(); // any click on the map closes an open picker first

    if (ids.length === 1) {
      onRouteSelect(ids[0]!, ids); // only one route here: select it straight away
    } else if (ids.length > 1) {
      // Several routes overlap here: ask which one, right where the user clicked.
      setOpenedPicker({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, ids, forItineraries: itineraries, forModes: visibleModes });
    }
    // ids.length === 0: clicked empty map, nothing else to do
  };

  // The same colour assignment the lines use, so the picker's circles match the map.
  const colors = useMemo(() => assignRouteColors(itineraries.map((it) => it.id)), [itineraries]);

  // Look up the full trips for the picker (it needs their colour, duration and summary).
  const pickerCandidates = useMemo(() => {
    if (!picker) return [];
    const byId = new globalThis.Map(itineraries.map((it) => [it.id, it])); // globalThis.Map: `Map` here is react-map-gl's component
    return picker.ids.map((id) => byId.get(id)).filter((it): it is Itinerary => it !== undefined);
  }, [picker, itineraries]);

  return (
    <Map
      ref={mapRef}
      mapStyle={styleUrl} // basemap chosen by the app (decision D8)
      initialViewState={INITIAL_VIEW}
      style={{ width: '100%', height: '100%' }}
      onLoad={fitToRoutes} // first fit, once the map is ready (the effect above may run before that)
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
        <Marker longitude={userLocation[0]} latitude={userLocation[1]}>
          <div
            title="You are here"
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#2563eb',
              border: '3px solid #ffffff',
              boxShadow: '0 0 0 1px rgb(0 0 0 / 0.25), 0 1px 4px rgb(0 0 0 / 0.3)'
            }}
          />
        </Marker>
      )}

      {/* The overlap picker, pinned to the click point. Picking reports the choice to the app and
          passes along all the candidates, as the contract says. */}
      {picker && pickerCandidates.length > 1 && (
        <Marker longitude={picker.longitude} latitude={picker.latitude} anchor="center" style={{ zIndex: 2 }}>
          <RoutePicker
            candidates={pickerCandidates}
            colors={colors}
            onPreview={setPreviewId}
            onClose={closePicker}
            onPick={(id) => {
              closePicker();
              onRouteSelect(id, picker.ids);
            }}
          />
        </Marker>
      )}
    </Map>
  );
}
