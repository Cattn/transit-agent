/**
 * Plan 009 step 3: one colour per itinerary.
 *
 * Why: the map acts as the user's route library, like Google Maps' blue line but with a
 * different colour per route. The same saved trip must get the same colour every time the app
 * opens, so the colour is derived from the itinerary id, not from its position in a list.
 *
 * Tests: colors.test.ts
 */

/**
 * 8 colours that are easy to tell apart and stay readable on a light grey basemap
 * (Tailwind 600/700 shades). No pale yellow or light green: the white casing drawn under
 * the selected route would make them vanish.
 */
export const PALETTE: readonly string[] = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#db2777', // pink
  '#4d7c0f'  // olive
];

/**
 * Line widths, in screen pixels. Lines are thinner when zoomed out (whole states/countries on
 * screen) and full width at city zoom; layers.ts blends between the two by zoom level.
 * Thinner lines when zoomed out = a clear gap between side-by-side lanes at every zoom.
 */
export const LINE_WIDTH = 5; // city zoom (14 and closer)
export const SELECTED_LINE_WIDTH = 7;
export const LINE_WIDTH_ZOOMED_OUT = 3; // country zoom (5 and further out)
export const SELECTED_LINE_WIDTH_ZOOMED_OUT = 5;
export const CASING_EXTRA_WIDTH = 4;
export const DIMMED_OPACITY = 0.35;
/**
 * Side-by-side lanes: neighbouring trips are drawn this many screen pixels apart (centre to centre),
 * so trips on the same street show up as parallel coloured lines. 10 px leaves a visible gap of
 * 5 px at city zoom (5 px lines) and 7 px when zoomed out (3 px lines).
 */
export const LANE_SPACING = 10;

/**
 * Turn a string into a non-negative integer that is always the same for the same string.
 * This is the 32-bit FNV-1a hash: simple, fast, and it spreads similar ids
 * ("fx-transit-1", "fx-transit-2") far apart.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5; // FNV "offset basis": the agreed starting value

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i); // XOR: mix this character's bits into the hash
    hash = Math.imul(hash, 0x01000193); // multiply by the FNV prime, keeping 32-bit integer maths
    // (plain `*` would overflow into floating point and lose the low bits that `% 8` relies on)
  }

  return hash >>> 0; // `>>> 0` reinterprets the 32 bits as unsigned, so the result is never negative
}

/** Pick a palette colour for an itinerary id. The same id always gives the same colour. */
export function routeColor(itineraryId: string): string {
  const index = hashString(itineraryId) % PALETTE.length; // 0..7
  return PALETTE[index]!; // `!`: index is always in range, but noUncheckedIndexedAccess can't know that
}

/**
 * Colours for a SET of trips shown together (one map, one results list).
 *
 * Hashing alone can give two trips on screen the same colour (8 colours, any number of ids), which
 * makes side-by-side lanes useless. So: each trip starts at its own routeColor(id); if an earlier
 * trip in the list already took that colour, it moves on to the next unused palette colour.
 * With up to 8 trips every one is different; past 8, colours repeat.
 * Same list in the same order → same colours, so the map, the picker and the result cards agree.
 */
export function assignRouteColors(itineraryIds: readonly string[]): Map<string, string> {
  const used = new Set<string>();
  const colors = new Map<string, string>();

  for (const id of itineraryIds) {
    if (colors.has(id)) continue; // listed twice: keep the first colour
    const start = hashString(id) % PALETTE.length; // this trip's preferred colour
    let color = PALETTE[start]!;
    for (let step = 0; step < PALETTE.length; step++) {
      const candidate = PALETTE[(start + step) % PALETTE.length]!;
      if (!used.has(candidate)) {
        color = candidate; // first colour, from the preferred one onwards, that nobody has yet
        break;
      }
    }
    used.add(color);
    colors.set(id, color);
  }
  return colors;
}
