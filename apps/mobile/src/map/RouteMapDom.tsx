'use dom';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import type { DOMProps } from 'expo/dom';
import type { Itinerary, TravelMode } from '@transit/shared';
import { RouteMap } from '@transit/maps/web';

setWorkerUrl(new URL(`${process.env.EXPO_BASE_URL ?? ''}maplibre-gl-worker.js`, window.location.href).href);

const PAGE_STYLE = 'html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }';

export interface RouteMapDomProps {
  itineraries: Itinerary[];
  selectedItineraryId?: string;
  onRouteSelect: (itineraryId: string, candidates: string[]) => Promise<void>;
  onDeselect?: () => Promise<void>;
  visibleModes?: TravelMode[];
  styleUrl: string;
  userLocation?: [number, number];
  userHeading?: number;
  locateKey?: string | number;
  fitKey?: string | number;
  padding?: { top: number; right: number; bottom: number; left: number };
  routeColors?: Record<string, string>;
  unfocusedColors?: 'grey' | 'trip' | 'mode';
  variant?: 'saved' | 'choosing';
  accentColor?: string;
  dom?: DOMProps;
}

export default function RouteMapDom({ onRouteSelect, onDeselect, routeColors, ...props }: RouteMapDomProps) {
  return (
    <>
      <style>{PAGE_STYLE}</style>
      <div style={{ position: 'fixed', inset: 0 }}>
        <RouteMap
          {...props}
          routeColors={routeColors ? new Map(Object.entries(routeColors)) : undefined}
          onRouteSelect={(id, candidates) => void onRouteSelect(id, candidates)}
          onDeselect={onDeselect ? () => void onDeselect() : undefined}
        />
      </div>
    </>
  );
}
