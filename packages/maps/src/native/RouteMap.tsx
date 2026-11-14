import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type CameraRef,
  type LayerProps,
  type PressEventWithFeatures
} from '@maplibre/maplibre-react-native';
import type { Itinerary } from '@transit/shared';
import type { FeatureCollection, Point } from 'geojson';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';
import { boundsOf, flatFitBounds, uniqueItineraryIds } from '../bounds.js';
import { assignRouteColors } from '../colors.js';
import type { RouteMapProps } from '../contract.js';
import { POINT_SOURCE_ID, ROUTE_SOURCE_ID, routeLayers, type RouteLayer } from '../layers.js';
import { itinerariesToFeatures, itineraryPoints } from '../to-geojson.js';
import { RoutePicker } from './RoutePicker.js';

const INITIAL_VIEW = { center: [-71.075, 42.359] as [number, number], zoom: 13.5 };
const DEFAULT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const FIT_DURATION = 600;
const TOUCH_HITBOX = { top: 10, right: 10, bottom: 10, left: 10 };
const LOCATION_SOURCE_ID = 'user-location';

function toLayerProps(layer: RouteLayer): LayerProps {
  return layer as unknown as LayerProps;
}

export function RouteMap({
  itineraries,
  selectedItineraryId,
  onRouteSelect,
  visibleModes,
  styleUrl,
  userLocation,
  fitKey,
  padding = DEFAULT_PADDING,
  routeColors
}: RouteMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [openedPicker, setOpenedPicker] = useState<{
    point: [number, number];
    ids: string[];
    forItineraries: Itinerary[];
    forModes: RouteMapProps['visibleModes'];
  } | null>(null);

  const picker =
    openedPicker && openedPicker.forItineraries === itineraries && openedPicker.forModes === visibleModes
      ? openedPicker
      : null;
  const closePicker = useCallback(() => setOpenedPicker(null), []);

  const fitToRoutes = useEffectEvent(() => {
    const bounds = boundsOf(itineraries, visibleModes);
    if (!bounds) return;
    cameraRef.current?.fitBounds(flatFitBounds(bounds), { padding, duration: FIT_DURATION });
  });

  useEffect(() => {
    if (mapReady) fitToRoutes();
  }, [fitKey, mapReady]);

  const handleRoutePress = (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const ids = uniqueItineraryIds(event.nativeEvent.features);
    if (ids.length === 1) {
      onRouteSelect(ids[0]!, ids);
    } else if (ids.length > 1) {
      setOpenedPicker({ point: event.nativeEvent.point, ids, forItineraries: itineraries, forModes: visibleModes });
    }
  };

  const colors = useMemo(() => {
    const auto = assignRouteColors(itineraries.map((it) => it.id));
    return new globalThis.Map(itineraries.map((it) => [it.id, routeColors?.get(it.id) ?? auto.get(it.id)!]));
  }, [itineraries, routeColors]);

  const pickerCandidates = useMemo(() => {
    if (!picker) return [];
    const byId = new globalThis.Map(itineraries.map((it) => [it.id, it]));
    return picker.ids.map((id) => byId.get(id)).filter((it): it is Itinerary => it !== undefined);
  }, [picker, itineraries]);

  const lines = useMemo(
    () => itinerariesToFeatures(itineraries, { selectedItineraryId, visibleModes, colors: routeColors }),
    [itineraries, selectedItineraryId, visibleModes, routeColors]
  );
  const points = useMemo(
    () => itineraryPoints(itineraries, { selectedItineraryId, visibleModes, colors: routeColors }),
    [itineraries, selectedItineraryId, visibleModes, routeColors]
  );

  const layers = useMemo(() => routeLayers(), []);
  const lineLayers = layers.filter((layer) => layer.source === ROUTE_SOURCE_ID);
  const pointLayers = layers.filter((layer) => layer.source === POINT_SOURCE_ID);

  const location = useMemo<FeatureCollection<Point> | undefined>(
    () =>
      userLocation && {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...userLocation] } }]
      },
    [userLocation]
  );

  return (
    <View
      style={styles.fill}
      onLayout={(event) => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      <MapLibreMap mapStyle={styleUrl} onDidFinishLoadingMap={() => setMapReady(true)}>
        <Camera ref={cameraRef} initialViewState={INITIAL_VIEW} />

        <GeoJSONSource id={ROUTE_SOURCE_ID} data={lines} onPress={handleRoutePress} hitbox={TOUCH_HITBOX}>
          {lineLayers.map((layer) => (
            <Layer key={layer.id} {...toLayerProps(layer)} />
          ))}
        </GeoJSONSource>

        <GeoJSONSource id={POINT_SOURCE_ID} data={points}>
          {pointLayers.map((layer) => (
            <Layer key={layer.id} {...toLayerProps(layer)} />
          ))}
        </GeoJSONSource>

        {location && (
          <GeoJSONSource id={LOCATION_SOURCE_ID} data={location}>
            <Layer
              id={LOCATION_SOURCE_ID}
              type="circle"
              source={LOCATION_SOURCE_ID}
              paint={{
                'circle-radius': 7,
                'circle-color': '#2563eb',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff'
              }}
            />
          </GeoJSONSource>
        )}
      </MapLibreMap>

      {picker && pickerCandidates.length > 1 && (
        <RoutePicker
          candidates={pickerCandidates}
          colors={colors}
          center={picker.point}
          area={area}
          onClose={closePicker}
          onPick={(id) => {
            closePicker();
            onRouteSelect(id, picker.ids);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }
});
