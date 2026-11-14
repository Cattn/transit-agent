import { z } from 'zod';

export const travelModes = ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry', 'car', 'flight'] as const;
export const TravelModeSchema = z.enum(travelModes);
export type TravelMode = z.infer<typeof TravelModeSchema>;

/** Modes whose times come from a timetable and can be late. */
export const scheduledModes: readonly TravelMode[] = ['bus', 'rail', 'ferry', 'flight'];

/** Product tabs (issue #4: "tabs for car, bus/bike, plane"). A tab is a filter over modes, not a separate data model. */
export const modeGroups = {
  transit: ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry'],
  drive: ['walk', 'car'],
  fly: ['walk', 'car', 'rail', 'bus', 'flight']
} as const satisfies Record<string, readonly TravelMode[]>;
export type ModeGroup = keyof typeof modeGroups;
