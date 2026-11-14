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
 * makes side-by-side lanes useless. So, in two passes:
 *   1. Every trip whose preferred colour, routeColor(id), nobody else on screen wants keeps it. When
 *      several trips want the same colour, the one whose id sorts first keeps it.
 *   2. The trips that lost a clash then take the next free palette colour after their preferred one.
 * So a trip only ever changes colour when it actually clashes. With up to 8 trips every one is
 * different; past 8, colours repeat.
 *
 * The ORDER of the list doesn't matter (ids are sorted first), so re-ranking results never swaps
 * colours. The SET does: a different set of trips can resolve clashes differently. So compute this
 * once for everything you show and pass the same map to the map (RouteMap's `routeColors`) and to
 * the result cards. Don't recompute it for a filtered subset.
 *
 * `fixed` holds saved trips' colours (SavedItinerary.color): a listed trip found there gets exactly
 * that colour, and every colour in it counts as taken, even for saved trips not on screen.
 */
export function assignRouteColors(
  itineraryIds: readonly string[],
  fixed?: ReadonlyMap<string, string>
): Map<string, string> {
  // Sorted and de-duplicated, so the result depends only on WHICH trips there are.
  const ids = [...new Set(itineraryIds)].sort();
  const preferred = (id: string) => hashString(id) % PALETTE.length;

  const colors = new Map<string, string>();
  const used = new Set<string>();
  const bumped: string[] = [];

  for (const color of fixed?.values() ?? []) used.add(color.toLowerCase());
  for (const id of ids) {
    const saved = fixed?.get(id);
    if (saved !== undefined) colors.set(id, saved);
  }

  // Pass 1: the first (by sorted id) trip to want each colour keeps it.
  for (const id of ids) {
    if (colors.has(id)) continue;
    const color = PALETTE[preferred(id)]!;
    if (used.has(color)) {
      bumped.push(id);
    } else {
      used.add(color);
      colors.set(id, color);
    }
  }

  // Pass 2: trips that lost a clash take the next free colour after their preferred one.
  for (const id of bumped) {
    let color = PALETTE[preferred(id)]!; // if all 8 are taken, colours repeat
    for (let step = 1; step < PALETTE.length; step++) {
      const candidate = PALETTE[(preferred(id) + step) % PALETTE.length]!;
      if (!used.has(candidate)) {
        color = candidate;
        break;
      }
    }
    used.add(color);
    colors.set(id, color);
  }
  return colors;
}
