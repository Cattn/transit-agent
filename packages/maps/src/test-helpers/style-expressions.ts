/**
 * TEST-ONLY helper (excluded from the build): a tiny evaluator for the MapLibre style expressions this
 * package uses, so tests can check what the map would actually do: which layer draws a feature
 * (filters) and how far a line is really shifted (line-offset). It throws on anything it doesn't know,
 * so a new kind of expression makes the tests fail loudly instead of passing by accident.
 * Spec: https://maplibre.org/maplibre-style-spec/expressions/
 */
export type FeatureProps = Record<string, unknown>;

export function evaluate(expression: unknown, props: FeatureProps, zoom = 14): unknown {
  if (!Array.isArray(expression)) return expression; // a literal: number, string, boolean
  const [op, ...args] = expression as [string, ...unknown[]];
  const ev = (e: unknown) => evaluate(e, props, zoom);

  switch (op) {
    case 'get':
      return props[args[0] as string];
    case 'zoom':
      return zoom;
    case '==':
      return ev(args[0]) === ev(args[1]);
    case '!=':
      return ev(args[0]) !== ev(args[1]);
    case '!':
      return !ev(args[0]);
    case 'all':
      return args.every((a) => ev(a) === true);
    case 'any':
      return args.some((a) => ev(a) === true);
    case '*':
      return args.reduce<number>((product, a) => product * Number(ev(a)), 1);
    case 'case': {
      // ['case', cond1, out1, cond2, out2, ..., fallback]
      for (let i = 0; i + 1 < args.length; i += 2) if (ev(args[i]) === true) return ev(args[i + 1]);
      return ev(args.at(-1));
    }
    case 'match': {
      // ['match', input, label1, out1, label2, out2, ..., fallback]
      const input = ev(args[0]);
      for (let i = 1; i + 1 < args.length; i += 2) if (args[i] === input) return ev(args[i + 1]);
      return ev(args.at(-1));
    }
    case 'interpolate': {
      // ['interpolate', ['linear'], input, stop1, out1, stop2, out2, ...]
      const input = Number(ev(args[1]));
      const stops: Array<[number, number]> = [];
      for (let i = 2; i + 1 < args.length; i += 2) stops.push([Number(args[i]), Number(ev(args[i + 1]))]);
      if (input <= stops[0]![0]) return stops[0]![1];
      for (let i = 1; i < stops.length; i++) {
        const [z0, v0] = stops[i - 1]!;
        const [z1, v1] = stops[i]!;
        if (input <= z1) return v0 + ((input - z0) / (z1 - z0)) * (v1 - v0);
      }
      return stops.at(-1)![1];
    }
    default:
      throw new Error(`style-expressions test helper: unsupported expression "${String(op)}"`);
  }
}

/** Does a layer with this filter draw a feature with these properties? (No filter = draws everything.) */
export function matchesFilter(filter: unknown, props: FeatureProps): boolean {
  return filter === undefined || evaluate(filter, props) === true;
}
