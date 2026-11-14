/**
 * The on-map overlap picker: a ring of coloured circles that pops up where you clicked when the
 * click hit several routes. One circle per route, in the route's own colour, showing its duration.
 *   - hover a circle  → that route is previewed (highlighted) on the map
 *   - click a circle  → that route is selected
 *   - click ×, press Escape, or click empty map → closes
 *
 * It's part of the maps package (not the app's UI) because it needs the click position on the map.
 * Inline styles only: the package can't rely on the app's CSS.
 */
import { useEffect } from 'react';
import type { Itinerary } from '@transit/shared';

const BUTTON_SIZE = 34; // px, a comfortable finger target

interface RoutePickerProps {
  /** The overlapping trips, topmost first. */
  candidates: Itinerary[];
  /** Colour per trip id, from assignRouteColors(), so each circle matches its line on the map. */
  colors: Map<string, string>;
  onPick: (itineraryId: string) => void;
  /** Called with an id while hovering a circle, and with null when the pointer leaves it. */
  onPreview: (itineraryId: string | null) => void;
  onClose: () => void;
}

/** Stop clicks inside the picker from reaching the map underneath (which would close or re-open it). */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export function RoutePicker({ candidates, colors, onPick, onPreview, onClose }: RoutePickerProps) {
  // Escape closes the picker. The listener only exists while the picker is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Spread the circles evenly around a ring. More routes → a bigger ring so they don't touch.
  const radius = Math.max(40, (candidates.length * (BUTTON_SIZE + 8)) / (2 * Math.PI));
  const diameter = radius * 2 + BUTTON_SIZE + 12;

  return (
    // A zero-size anchor: the react-map-gl <Marker> centres it on the click point, and everything
    // else is positioned around it with absolute positioning.
    <div
      role="menu"
      aria-label="Choose a route"
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
      onDoubleClick={stop}
      style={{ position: 'relative', width: 0, height: 0 }}
    >
      {/* Frosted background disc so the circles stay readable over busy map areas. */}
      <div
        style={{
          position: 'absolute',
          left: -diameter / 2,
          top: -diameter / 2,
          width: diameter,
          height: diameter,
          borderRadius: '50%',
          background: 'rgb(255 255 255 / 0.75)',
          boxShadow: '0 4px 16px rgb(0 0 0 / 0.25)',
          backdropFilter: 'blur(2px)'
        }}
      />

      {candidates.map((itinerary, i) => {
        // Start at 12 o'clock (−90°) and go clockwise, so the topmost route is at the top.
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / candidates.length;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <button
            key={itinerary.id}
            type="button"
            role="menuitem"
            title={`${itinerary.durationMinutes} min · ${itinerary.summary}`} // full description on hover
            aria-label={`${itinerary.durationMinutes} minutes: ${itinerary.summary}`}
            onClick={() => onPick(itinerary.id)}
            onMouseEnter={() => onPreview(itinerary.id)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(itinerary.id)} // keyboard users get the preview too
            onBlur={() => onPreview(null)}
            style={{
              position: 'absolute',
              left: x - BUTTON_SIZE / 2,
              top: y - BUTTON_SIZE / 2,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: '50%',
              border: '3px solid #ffffff',
              background: colors.get(itinerary.id), // same colour as the route on the map
              color: '#ffffff',
              font: '700 11px system-ui, sans-serif',
              textShadow: '0 0 2px rgb(0 0 0 / 0.6)',
              boxShadow: '0 1px 4px rgb(0 0 0 / 0.35)',
              cursor: 'pointer',
              padding: 0
            }}
          >
            {itinerary.durationMinutes}m
          </button>
        );
      })}

      {/* Close button in the middle of the ring (also marks exactly where you clicked). */}
      <button
        type="button"
        aria-label="Close route picker"
        title="Close"
        onClick={onClose}
        style={{
          position: 'absolute',
          left: -11,
          top: -11,
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '1px solid rgb(0 0 0 / 0.2)',
          background: '#ffffff',
          color: '#374151',
          font: '700 13px/1 system-ui, sans-serif',
          cursor: 'pointer',
          padding: 0
        }}
      >
        ×
      </button>
    </div>
  );
}
