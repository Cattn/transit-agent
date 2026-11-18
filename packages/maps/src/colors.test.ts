import { describe, expect, it } from 'vitest';
import { PALETTE, assignRouteColors, hashString, routeColor } from './colors.js';
import { DEFAULT_PRESET_COLORS, DEFAULT_PRESET_ICONS, isPresetKey, nextPlaceColor, placeFor, presetColor, presetIcon, presetPlace, presetTripColors, profilePlaces, removeCustomPlace, upsertCustomPlace, withPresetColors } from './presets.js';

describe('PALETTE', () => {
  it('has 8 distinct hex colours', () => {
    expect(PALETTE).toHaveLength(8);
    expect(new Set(PALETTE.map((c) => c.toLowerCase())).size).toBe(8);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('fx-transit-abc123')).toBe(hashString('fx-transit-abc123'));
  });

  it('returns a non-negative integer', () => {
    for (const s of ['', 'a', 'sample-red-line', 'a much longer itinerary id with spaces 12345']) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives different values for different strings', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('ab')).not.toBe(hashString('ba'));
  });
});

describe('routeColor', () => {
  it('returns a palette colour', () => {
    expect(PALETTE).toContain(routeColor('sample-red-line'));
  });

  it('is stable across calls (same saved trip, same colour)', () => {
    expect(routeColor('fx-transit-1')).toBe(routeColor('fx-transit-1'));
  });

  it('spreads ids across the palette', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `fx-transit-${i}`);
    expect(new Set(ids.map(routeColor)).size).toBeGreaterThanOrEqual(6);
  });
});

describe('assignRouteColors (no two trips on screen share a colour)', () => {
  it('gives up to 8 trips 8 different colours, even when their hashes collide', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `fx-transit-${i}`);
    const colors = assignRouteColors(ids);
    expect(new Set(colors.values()).size).toBe(8);
    for (const c of colors.values()) expect(PALETTE).toContain(c);
  });

  it('a trip with no clash keeps its own routeColor', () => {
    expect(assignRouteColors(['b']).get('b')).toBe(routeColor('b'));
    const noClash = Array.from({ length: 50 }, (_, i) => `trip-${i}`).find((id) => routeColor(id) !== routeColor('trip-0'))!;
    expect(assignRouteColors(['trip-0', noClash]).get(noClash)).toBe(routeColor(noClash));
  });

  it('resolves a real collision so the two trips get different colours', () => {
    const first = 'trip-0';
    const clash = Array.from({ length: 200 }, (_, i) => `trip-${i + 1}`).find((id) => routeColor(id) === routeColor(first))!;
    const colors = assignRouteColors([first, clash]);
    expect(colors.get(clash)).not.toBe(colors.get(first));
  });

  it('a trip keeps its own routeColor whenever no other trip on screen wants that colour (PR #35 review, issue 3)', () => {
    // Many pseudo-random sets of 2 to 8 trips, including chains (A and B clash, and C wants the
    // colour B gets bumped to): every trip whose preferred colour is unique in its set keeps it.
    for (let seed = 0; seed < 300; seed++) {
      const size = 2 + (seed % 7);
      const ids = Array.from({ length: size }, (_, i) => `t${(seed * 7919 + i * 104729) % 100000}`);
      const colors = assignRouteColors(ids);
      for (const id of ids) {
        const wanted = routeColor(id);
        const competitors = ids.filter((other) => other !== id && routeColor(other) === wanted);
        if (competitors.length === 0) expect(colors.get(id), `${id} in [${ids}]`).toBe(wanted);
      }
      expect(new Set(colors.values()).size, `unique colours for [${ids}]`).toBe(new Set(ids).size);
    }
  });

  it('gives the same colours whatever order the trips are listed in (PR #35 review, issue 3)', () => {
    const asObject = (ids: string[]) => Object.fromEntries(assignRouteColors(ids));
    // Cattn's reproduction: these two clash, and used to swap colours when reordered.
    expect(asObject(['trip-8', 'trip-0'])).toEqual(asObject(['trip-0', 'trip-8']));
    const ids = Array.from({ length: 8 }, (_, i) => `fx-transit-${i}`);
    const expected = asObject(ids);
    expect(asObject([...ids].reverse())).toEqual(expected);
    expect(asObject([...ids.slice(3), ...ids.slice(0, 3)])).toEqual(expected);
  });

  it('is the same every time for the same list', () => {
    const ids = ['x', 'y', 'z'];
    expect([...assignRouteColors(ids)]).toEqual([...assignRouteColors(ids)]);
  });
});

describe('assignRouteColors with saved colours (plan 009 step 5)', () => {
  const idWanting = (color: string, skip: string[] = []) =>
    Array.from({ length: 1000 }, (_, i) => `trip-${i}`).find((id) => routeColor(id) === color && !skip.includes(id))!;
  const [blue, red, green] = PALETTE as [string, string, string];

  it('gives a listed saved trip exactly its saved colour, even one outside the palette', () => {
    const saved = idWanting(blue);
    const fixed = new Map([[saved, red], ['old-save', '#123456']]);
    const colors = assignRouteColors([saved, 'old-save', 'new-trip'], fixed);
    expect(colors.get(saved)).toBe(red);
    expect(colors.get('old-save')).toBe('#123456');
  });

  it('never gives a new trip a saved colour, even when that saved trip is not on screen', () => {
    const newTrip = idWanting(blue);
    const colors = assignRouteColors([newTrip], new Map([['saved-elsewhere', blue]]));
    expect(colors.get(newTrip)).not.toBe(blue);
    expect(PALETTE).toContain(colors.get(newTrip));
  });

  it('treats a saved colour as taken whatever its letter case', () => {
    const newTrip = idWanting(blue);
    const colors = assignRouteColors([newTrip], new Map([['saved-elsewhere', blue.toUpperCase()]]));
    expect(colors.get(newTrip)?.toLowerCase()).not.toBe(blue.toLowerCase());
  });

  it('lets a new trip keep its own routeColor when no saved or new trip wants it', () => {
    const newTrip = idWanting(green);
    const colors = assignRouteColors([newTrip, 'saved-a'], new Map([['saved-a', blue], ['saved-b', red]]));
    expect(colors.get(newTrip)).toBe(green);
  });

  it('gives saved and new trips all different colours while 8 or fewer are in use', () => {
    const fixed = new Map([['saved-a', PALETTE[0]!], ['saved-b', PALETTE[3]!], ['saved-off-screen', PALETTE[5]!]]);
    const newTrips = Array.from({ length: 5 }, (_, i) => `fx-transit-${i}`);
    const colors = assignRouteColors(['saved-a', 'saved-b', ...newTrips], fixed);
    const used = [...colors.values(), PALETTE[5]!];
    expect(new Set(used).size).toBe(used.length);
  });

  it('only returns the listed trips', () => {
    const colors = assignRouteColors(['b', 'a', 'b'], new Map([['a', red], ['not-listed', blue]]));
    expect([...colors.keys()].sort()).toEqual(['a', 'b']);
  });

  it('gives the same colours whatever order the trips are listed in', () => {
    const fixed = new Map([['saved-a', blue], ['saved-b', green]]);
    const ids = ['saved-a', 'saved-b', ...Array.from({ length: 6 }, (_, i) => `fx-transit-${i}`)];
    const asObject = (list: string[]) => Object.fromEntries(assignRouteColors(list, fixed));
    expect(asObject([...ids].reverse())).toEqual(asObject(ids));
    expect(asObject([...ids.slice(3), ...ids.slice(0, 3)])).toEqual(asObject(ids));
  });

  it('keeps two listed saved trips on their colour even when they were saved with the same one', () => {
    const colors = assignRouteColors(['saved-a', 'saved-b'], new Map([['saved-a', red], ['saved-b', red]]));
    expect(colors.get('saved-a')).toBe(red);
    expect(colors.get('saved-b')).toBe(red);
  });

  it('repeats colours past 8 instead of failing', () => {
    const fixed = new Map(PALETTE.map((color, i) => [`saved-${i}`, color]));
    const colors = assignRouteColors(['new-1', 'new-2', 'new-3'], fixed);
    expect(colors.size).toBe(3);
    for (const c of colors.values()) expect(PALETTE).toContain(c);
  });

  it('without saved colours gives exactly the same result as before', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = Array.from({ length: 1 + (seed % 10) }, (_, i) => `t${(seed * 7919 + i * 104729) % 100000}`);
      const before = [...assignRouteColors(ids)];
      expect([...assignRouteColors(ids, undefined)]).toEqual(before);
      expect([...assignRouteColors(ids, new Map())]).toEqual(before);
    }
  });
});

describe('place presets (plan 038)', () => {
  const home = { name: 'Home', coordinates: [-71.0652, 42.3592] as [number, number] };
  const office = { name: 'Office', coordinates: [-71.0752, 42.3496] as [number, number] };
  const gym = { name: 'Gym', coordinates: [-71.1, 42.37] as [number, number] };
  const near = (place: { coordinates: [number, number] }, metresNorth: number) => ({ name: 'Somewhere', coordinates: [place.coordinates[0], place.coordinates[1] + metresNorth / 111_320] as [number, number] });
  const profile = { home, work: office, presets: { gym: { place: gym, color: '#db2777' } } };

  it('gives each preset a different palette colour and its own icon by default', () => {
    const defaults = Object.values(DEFAULT_PRESET_COLORS);
    expect(new Set(defaults).size).toBe(defaults.length);
    for (const color of defaults) expect(PALETTE).toContain(color);
    expect(DEFAULT_PRESET_ICONS).toEqual({ home: 'home', office: 'work', gym: 'fitness' });
  });

  it('uses the chosen colour and icon when set, the defaults otherwise', () => {
    expect(presetColor('gym', profile)).toBe('#db2777');
    expect(presetColor('home', profile)).toBe(DEFAULT_PRESET_COLORS.home);
    expect(presetColor('office', undefined)).toBe(DEFAULT_PRESET_COLORS.office);
    expect(presetIcon('gym', { presets: { gym: { icon: 'park' } } })).toBe('park');
    expect(presetIcon('gym', profile)).toBe('fitness');
  });

  it('takes Home and Office from the profile places and Gym from its preset', () => {
    expect(presetPlace('home', profile)).toBe(home);
    expect(presetPlace('office', profile)).toBe(office);
    expect(presetPlace('gym', profile)).toBe(gym);
    expect(presetPlace('gym', { home })).toBeUndefined();
  });

  it('matches a place within 150 m of a preset, and nothing further away', () => {
    expect(placeFor(near(office, 100), profile)?.key).toBe('office');
    expect(placeFor(near(office, 200), profile)?.key).toBeUndefined();
    expect(placeFor(near(gym, 0), profile)?.key).toBe('gym');
    expect(placeFor(near(gym, 0), { home, work: office })?.key).toBeUndefined();
  });

  it('picks the closest preset when two are within 150 m', () => {
    const together = { home, work: near(home, 120) };
    expect(placeFor(near(home, 100), together)?.key).toBe('office');
    expect(placeFor(near(home, 10), together)?.key).toBe('home');
  });

  it('colours saved trips that go to a preset, and leaves the others alone', () => {
    const trips = [
      { id: 'to-office-1', request: { destination: near(office, 20) } },
      { id: 'to-office-2', request: { destination: near(office, 60) } },
      { id: 'to-gym', request: { destination: gym } },
      { id: 'elsewhere', request: { destination: near(gym, 2000) } }
    ];
    expect(presetTripColors(trips, profile)).toEqual(new Map([
      ['to-office-1', DEFAULT_PRESET_COLORS.office],
      ['to-office-2', DEFAULT_PRESET_COLORS.office],
      ['to-gym', '#db2777']
    ]));
  });

  it('keeps preset colours when combined with assignRouteColors, so no other trip borrows them', () => {
    const fixed = presetTripColors([{ id: 'to-gym', request: { destination: gym } }], profile);
    const ids = ['to-gym', ...Array.from({ length: 6 }, (_, i) => `other-${i}`)];
    const colors = assignRouteColors(ids, fixed);
    expect(colors.get('to-gym')).toBe('#db2777');
    expect(ids.slice(1).map((id) => colors.get(id))).not.toContain('#db2777');
  });

  it('moves an unrelated saved trip off a preset colour it was stored with (PR #98 review)', () => {
    const orange = '#ea580c';
    const fixed = withPresetColors(new Map([['to-home', PALETTE[0]!], ['unrelated', orange], ['kept', PALETTE[1]!]]), new Map([['to-home', orange]]));
    expect(fixed).toEqual(new Map([['kept', PALETTE[1]!], ['to-home', orange]]));
    const colors = assignRouteColors(['to-home', 'unrelated', 'kept'], fixed);
    expect(colors.get('to-home')).toBe(orange);
    expect(colors.get('kept')).toBe(PALETTE[1]);
    expect(new Set(colors.values()).size).toBe(3);
  });

  it('lists Home, Work, Gym, then the custom places (plan 040)', () => {
    const dinner = { id: 'dinner', name: 'Dinner', icon: 'restaurant' as const, color: '#7c3aed', place: near(gym, 3000) };
    expect(profilePlaces({ ...profile, places: [dinner] })).toEqual([
      { key: 'home', name: 'Home', icon: 'home', color: DEFAULT_PRESET_COLORS.home, place: home },
      { key: 'office', name: 'Work', icon: 'work', color: DEFAULT_PRESET_COLORS.office, place: office },
      { key: 'gym', name: 'Gym', icon: 'fitness', color: '#db2777', place: gym },
      { key: 'place:dinner', name: 'Dinner', icon: 'restaurant', color: '#7c3aed', place: dinner.place }
    ]);
    expect(profilePlaces(undefined).map((place) => place.key)).toEqual(['home', 'office', 'gym']);
  });

  it('matches and colours saved trips to a custom place, and the closest place wins across presets and custom places (plan 040)', () => {
    const dinner = { id: 'dinner', name: 'Dinner', icon: 'restaurant' as const, color: '#7c3aed', place: near(gym, 3000) };
    const cafe = { id: 'cafe', name: 'Cafe', icon: 'cafe' as const, color: '#0891b2', place: near(office, 80) };
    const withPlaces = { ...profile, places: [dinner, cafe] };
    expect(placeFor(near(dinner.place, 50), withPlaces)?.key).toBe('place:dinner');
    expect(placeFor(near(office, 70), withPlaces)?.key).toBe('place:cafe');
    expect(placeFor(near(office, 10), withPlaces)?.key).toBe('office');
    const gymTwin = { ...profile, places: [{ id: 'gym-twin', name: 'Gym', icon: 'fitness' as const, color: '#9333ea', place: gym }] };
    expect(placeFor(near(gym, 0), gymTwin)?.key).toBe('place:gym-twin');
    expect(presetTripColors([{ id: 'to-gym', request: { destination: near(gym, 0) } }], gymTwin).get('to-gym')).toBe('#9333ea');
    expect(presetTripColors([{ id: 'to-dinner', request: { destination: dinner.place } }, { id: 'to-office', request: { destination: office } }], withPlaces)).toEqual(new Map([
      ['to-dinner', '#7c3aed'],
      ['to-office', DEFAULT_PRESET_COLORS.office]
    ]));
  });

  it('starts a new place on a palette colour no place uses yet, then the least-used one (plan 040)', () => {
    const custom = (id: string, color: string) => ({ id, name: id, icon: 'favorite' as const, color, place: gym });
    const used = new Set([DEFAULT_PRESET_COLORS.home, DEFAULT_PRESET_COLORS.office, DEFAULT_PRESET_COLORS.gym]);
    const first = nextPlaceColor(undefined);
    expect(used.has(first)).toBe(false);
    expect(PALETTE).toContain(first);
    const places = PALETTE.filter((color) => !used.has(color)).map((color, index) => custom(`p${index}`, color.toUpperCase()));
    expect(nextPlaceColor({ places: places.slice(0, -1) })).toBe(places.at(-1)!.color.toLowerCase());
    expect(nextPlaceColor({ places })).toBe(PALETTE[0]);
    expect(nextPlaceColor({ places: [...places, custom('extra', PALETTE[0]!)] })).toBe(PALETTE[1]);
  });

  it('adds, edits and removes custom places without touching the others (plan 040)', () => {
    const dinner = { id: 'dinner', name: 'Dinner', icon: 'restaurant' as const, color: '#7c3aed', place: gym };
    const school = { id: 'school', name: 'School', icon: 'school' as const, color: '#0891b2', place: office };
    expect(upsertCustomPlace([dinner], 'new', { name: '  School ', icon: 'school', color: '#0891b2', place: office }, 'school')).toEqual([dinner, school]);
    expect(upsertCustomPlace([dinner], 'new', { name: 'No place', icon: 'school', color: '#0891b2' }, 'x')).toEqual([dinner]);
    expect(upsertCustomPlace(undefined, 'new', { name: 'Dinner', icon: 'restaurant', color: '#7c3aed', place: gym }, 'dinner')).toEqual([dinner]);
    expect(upsertCustomPlace([dinner, school], 'place:dinner', { name: 'Supper', icon: 'cafe', color: '#db2777' }, 'unused')).toEqual([
      { ...dinner, name: 'Supper', icon: 'cafe', color: '#db2777' },
      school
    ]);
    expect(upsertCustomPlace([dinner], 'place:dinner', { name: 'Dinner', icon: 'restaurant', color: '#7c3aed', place: home }, 'unused')).toEqual([{ ...dinner, place: home }]);
    expect(removeCustomPlace([dinner, school], 'place:dinner')).toEqual([school]);
    expect(removeCustomPlace(undefined, 'place:dinner')).toEqual([]);
    expect(['home', 'office', 'gym', 'place:dinner'].map(isPresetKey)).toEqual([true, true, true, false]);
  });

  it('matches preset colours regardless of hex case', () => {
    expect(withPresetColors(new Map([['unrelated', '#EA580C']]), new Map([['to-home', '#ea580c']]))).toEqual(new Map([['to-home', '#ea580c']]));
  });
});
