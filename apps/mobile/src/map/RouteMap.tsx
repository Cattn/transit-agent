import { useCallback, useMemo } from 'react';
import type { RouteMapProps } from '@transit/maps';
import RouteMapDom from './RouteMapDom';

const DOM_VIEW = { style: { flex: 1 }, scrollEnabled: false, bounces: false, overScrollMode: 'never' } as const;

export function RouteMap({ routeColors, onRouteSelect, onDeselect, onLoad, onLoadError, visibleModes, userLocation, ...props }: RouteMapProps) {
  const colors = useMemo(() => (routeColors ? Object.fromEntries(routeColors) : undefined), [routeColors]);
  const modes = useMemo(() => (visibleModes ? [...visibleModes] : undefined), [visibleModes]);
  const location = useMemo<[number, number] | undefined>(
    () => (userLocation ? [userLocation[0], userLocation[1]] : undefined),
    [userLocation]
  );
  const select = useCallback(
    async (itineraryId: string, candidates: string[]) => onRouteSelect(itineraryId, candidates),
    [onRouteSelect]
  );
  const deselect = useMemo(() => (onDeselect ? async () => onDeselect() : undefined), [onDeselect]);
  const load = useMemo(() => (onLoad ? async () => onLoad() : undefined), [onLoad]);
  const loadError = useMemo(() => (onLoadError ? async () => onLoadError() : undefined), [onLoadError]);

  return (
    <RouteMapDom
      {...props}
      visibleModes={modes}
      userLocation={location}
      routeColors={colors}
      onRouteSelect={select}
      onDeselect={deselect}
      onLoad={load}
      onLoadError={loadError}
      dom={DOM_VIEW}
    />
  );
}
