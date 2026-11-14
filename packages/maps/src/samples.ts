/**
 * Example routes for the demo page, the tests, and UI work before the server exists
 * (import from '@transit/maps/samples'). Two scenarios:
 *
 *   commuteOptions: ONE trip (MIT Stata Center → South Station, Monday 8:30 AM) by Red Line, bus and car.
 *     (Bike, bike + transit and walk versions are also generated below but not in the list.)
 *   flightOptions:  "how do I get to Florida?" (MIT → downtown Orlando), door to door:
 *     transit to Logan + fly BOS → MCO, commuter rail to Providence + fly PVD → Orlando Sanford (SFB),
 *     drive to Manchester NH + fly MHT → MCO.
 *
 * GENERATED from REAL route geometry (Transitous for transit, OSRM for drive/bike/walk), simplified to at
 * most 60 to 80 points per leg. Flights are SAMPLE schedules and fares (not real flights), drawn as
 * great-circle arcs, the shape the server will send (plan 011).
 * Do not edit by hand. Regenerate with: node packages/maps/scripts/gen-samples.mjs packages/maps/src/samples.ts
 *
 * Tests rely on: sampleItinerary = walk → Red Line → walk starting at 'MIT Stata Center';
 * sampleDrive = one car leg; sampleItineraries = commuteOptions.
 */
import type { Itinerary } from '@transit/shared';

export const sampleItinerary: Itinerary = {
  "id": "commute-red-line",
  "legs": [
    {
      "id": "commute-red-line-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "departAt": "2026-11-16T13:33:00Z",
      "arriveAt": "2026-11-16T13:40:00Z",
      "durationMinutes": 7,
      "distanceMeters": 429,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08829, 42.36245],
          [-71.08809, 42.36244],
          [-71.08808, 42.36248],
          [-71.08611, 42.36232],
          [-71.08612, 42.36215]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "commute-red-line-1",
      "mode": "rail",
      "from": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "departAt": "2026-11-16T13:40:00Z",
      "arriveAt": "2026-11-16T13:47:00Z",
      "durationMinutes": 7,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0856, 42.36235],
          [-71.08523, 42.36239],
          [-71.08343, 42.36213],
          [-71.07365, 42.36142],
          [-71.0706, 42.36116],
          [-71.06999, 42.36102],
          [-71.06934, 42.36074],
          [-71.06677, 42.35886],
          [-71.06586, 42.35812],
          [-71.06515, 42.35772],
          [-71.06029, 42.35532],
          [-71.05698, 42.35334],
          [-71.05517, 42.35256],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "commute-red-line-2",
      "mode": "walk",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523]
      },
      "departAt": "2026-11-16T13:47:00Z",
      "arriveAt": "2026-11-16T13:48:00Z",
      "durationMinutes": 1,
      "distanceMeters": 4,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05524, 42.35227],
          [-71.0552, 42.3523]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:33:00Z",
  "arriveAt": "2026-11-16T13:48:00Z",
  "durationMinutes": 15,
  "transfers": 0,
  "walkMinutes": 8,
  "cost": {
    "totalUsd": 2.4,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 7 min → Red Line → walk 1 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const commuteBus: Itinerary = {
  "id": "commute-bus",
  "legs": [
    {
      "id": "commute-bus-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "84 Massachusetts Ave",
        "coordinates": [-71.09355, 42.35867],
        "kind": "stop",
        "code": "us-ma-MBTA_75"
      },
      "departAt": "2026-11-16T13:52:00Z",
      "arriveAt": "2026-11-16T14:00:00Z",
      "durationMinutes": 8,
      "distanceMeters": 532,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09061, 42.36152],
          [-71.09063, 42.36142],
          [-71.09055, 42.36123],
          [-71.09056, 42.36116],
          [-71.09063, 42.36116],
          [-71.09061, 42.36101],
          [-71.09077, 42.36095],
          [-71.09078, 42.36097],
          [-71.09086, 42.36086],
          [-71.09099, 42.36078],
          [-71.09203, 42.36044],
          [-71.09173, 42.3599],
          [-71.09182, 42.35987],
          [-71.09171, 42.35968],
          [-71.09371, 42.359],
          [-71.09359, 42.35881],
          [-71.09357, 42.35867]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "commute-bus-1",
      "mode": "bus",
      "from": {
        "name": "84 Massachusetts Ave",
        "coordinates": [-71.09355, 42.35867],
        "kind": "stop",
        "code": "us-ma-MBTA_75"
      },
      "to": {
        "name": "Massachusetts Ave @ Washington St",
        "coordinates": [-71.07694, 42.3363],
        "kind": "stop",
        "code": "us-ma-MBTA_59"
      },
      "departAt": "2026-11-16T14:00:00Z",
      "arriveAt": "2026-11-16T14:15:00Z",
      "durationMinutes": 15,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09355, 42.35867],
          [-71.09338, 42.35872],
          [-71.09322, 42.35845],
          [-71.08659, 42.34494],
          [-71.08585, 42.34337],
          [-71.08326, 42.34161],
          [-71.08175, 42.34064],
          [-71.08024, 42.33911],
          [-71.07882, 42.3379],
          [-71.07702, 42.33646],
          [-71.07688, 42.33633],
          [-71.07694, 42.3363]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus 1",
      "agency": "MBTA"
    },
    {
      "id": "commute-bus-2",
      "mode": "walk",
      "from": {
        "name": "Massachusetts Ave @ Washington St",
        "coordinates": [-71.07694, 42.3363],
        "kind": "stop",
        "code": "us-ma-MBTA_59"
      },
      "to": {
        "name": "Washington St @ Massachusetts Ave",
        "coordinates": [-71.07707, 42.33634],
        "kind": "stop",
        "code": "us-ma-MBTA_5"
      },
      "departAt": "2026-11-16T14:15:00Z",
      "arriveAt": "2026-11-16T14:17:00Z",
      "durationMinutes": 2,
      "distanceMeters": 12,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07694, 42.33629],
          [-71.07705, 42.33635]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "commute-bus-3",
      "mode": "bus",
      "from": {
        "name": "Washington St @ Massachusetts Ave",
        "coordinates": [-71.07707, 42.33634],
        "kind": "stop",
        "code": "us-ma-MBTA_5"
      },
      "to": {
        "name": "Essex St @ Atlantic Ave",
        "coordinates": [-71.056, 42.35176],
        "kind": "stop",
        "code": "us-ma-MBTA_6538"
      },
      "departAt": "2026-11-16T14:19:00Z",
      "arriveAt": "2026-11-16T14:37:00Z",
      "durationMinutes": 18,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07707, 42.33634],
          [-71.07713, 42.33638],
          [-71.07429, 42.33841],
          [-71.07071, 42.34078],
          [-71.07007, 42.34115],
          [-71.06964, 42.34134],
          [-71.06841, 42.3418],
          [-71.06808, 42.342],
          [-71.06658, 42.34319],
          [-71.06626, 42.34348],
          [-71.06531, 42.34495],
          [-71.0648, 42.34588],
          [-71.06396, 42.34906],
          [-71.06383, 42.34944],
          [-71.06304, 42.35091],
          [-71.0628, 42.35158],
          [-71.0626, 42.35239],
          [-71.06067, 42.35254],
          [-71.05983, 42.35254],
          [-71.05939, 42.3525],
          [-71.05801, 42.35234],
          [-71.05714, 42.35209],
          [-71.05676, 42.35205],
          [-71.05596, 42.35184],
          [-71.056, 42.35176]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus SL4",
      "agency": "MBTA",
      "transferBufferMinutes": 4
    },
    {
      "id": "commute-bus-4",
      "mode": "walk",
      "from": {
        "name": "Essex St @ Atlantic Ave",
        "coordinates": [-71.056, 42.35176],
        "kind": "stop",
        "code": "us-ma-MBTA_6538"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523]
      },
      "departAt": "2026-11-16T14:37:00Z",
      "arriveAt": "2026-11-16T14:39:00Z",
      "durationMinutes": 2,
      "distanceMeters": 104,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05601, 42.35175],
          [-71.05581, 42.3517],
          [-71.05553, 42.35217],
          [-71.0552, 42.3523]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:52:00Z",
  "arriveAt": "2026-11-16T14:39:00Z",
  "durationMinutes": 47,
  "transfers": 1,
  "walkMinutes": 12,
  "cost": {
    "totalUsd": 3.4,
    "lines": [
      {
        "label": "Fare (Bus 1)",
        "usd": 1.7,
        "estimated": true
      },
      {
        "label": "Fare (Bus SL4)",
        "usd": 1.7,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "medium",
    "reasons": [
      "Bus times are scheduled, not live (sample)"
    ]
  },
  "violations": [],
  "summary": "Walk 8 min → Bus 1 → walk 2 min → Bus SL4 → walk 2 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const commuteBikeTransit: Itinerary = {
  "id": "commute-bike-transit",
  "legs": [
    {
      "id": "commute-bike-transit-0",
      "mode": "bike",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "84 Massachusetts Ave",
        "coordinates": [-71.09355, 42.35867],
        "kind": "stop",
        "code": "us-ma-MBTA_75"
      },
      "departAt": "2026-11-16T13:33:00Z",
      "arriveAt": "2026-11-16T13:36:00Z",
      "durationMinutes": 3,
      "distanceMeters": 622,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09061, 42.36209],
          [-71.09071, 42.36223],
          [-71.09123, 42.36194],
          [-71.09301, 42.36106],
          [-71.09254, 42.36027],
          [-71.09422, 42.3597],
          [-71.09365, 42.35915],
          [-71.09336, 42.35873]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "commute-bike-transit-1",
      "mode": "bus",
      "from": {
        "name": "84 Massachusetts Ave",
        "coordinates": [-71.09355, 42.35867],
        "kind": "stop",
        "code": "us-ma-MBTA_75"
      },
      "to": {
        "name": "Massachusetts Ave @ Marlborough St",
        "coordinates": [-71.08915, 42.34995],
        "kind": "stop",
        "code": "us-ma-MBTA_77"
      },
      "departAt": "2026-11-16T13:36:00Z",
      "arriveAt": "2026-11-16T13:41:00Z",
      "durationMinutes": 5,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09355, 42.35867],
          [-71.09338, 42.35872],
          [-71.09322, 42.35845],
          [-71.08929, 42.35045],
          [-71.08907, 42.34997],
          [-71.08915, 42.34995]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus 1",
      "agency": "MBTA"
    },
    {
      "id": "commute-bike-transit-2",
      "mode": "bike",
      "from": {
        "name": "Massachusetts Ave @ Marlborough St",
        "coordinates": [-71.08915, 42.34995],
        "kind": "stop",
        "code": "us-ma-MBTA_77"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523]
      },
      "departAt": "2026-11-16T13:41:00Z",
      "arriveAt": "2026-11-16T13:54:00Z",
      "durationMinutes": 13,
      "distanceMeters": 3194,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.08905, 42.34998],
          [-71.08909, 42.35007],
          [-71.08086, 42.35228],
          [-71.08029, 42.35113],
          [-71.07149, 42.3535],
          [-71.0707, 42.3519],
          [-71.07057, 42.3519],
          [-71.06929, 42.35219],
          [-71.06749, 42.35252],
          [-71.06711, 42.35253],
          [-71.06611, 42.35249],
          [-71.06467, 42.35239],
          [-71.06438, 42.35234],
          [-71.06349, 42.35231],
          [-71.06139, 42.35251],
          [-71.06014, 42.35257],
          [-71.05932, 42.35252],
          [-71.05829, 42.35238],
          [-71.058, 42.35238],
          [-71.05775, 42.35226],
          [-71.05753, 42.3522],
          [-71.05714, 42.35211],
          [-71.05691, 42.35212],
          [-71.05587, 42.35186],
          [-71.05544, 42.35259],
          [-71.05508, 42.35246]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:33:00Z",
  "arriveAt": "2026-11-16T13:54:00Z",
  "durationMinutes": 21,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 1.7,
    "lines": [
      {
        "label": "Fare (Bus 1)",
        "usd": 1.7,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "medium",
    "reasons": [
      "Bike on board: check peak-hour bike rules (sample)"
    ]
  },
  "violations": [],
  "summary": "Bike 3 min → Bus 1 → bike 13 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const commuteBike: Itinerary = {
  "id": "commute-bike",
  "legs": [
    {
      "id": "commute-bike-0",
      "mode": "bike",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616],
        "kind": "address"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523],
        "kind": "station"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:53:00Z",
      "durationMinutes": 23,
      "distanceMeters": 4097,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08821, 42.36245],
          [-71.08821, 42.36258],
          [-71.08812, 42.36258],
          [-71.08598, 42.36242],
          [-71.08506, 42.36233],
          [-71.08418, 42.3622],
          [-71.08402, 42.3622],
          [-71.08379, 42.36227],
          [-71.0834, 42.36214],
          [-71.08271, 42.36201],
          [-71.07578, 42.36149],
          [-71.07204, 42.36117],
          [-71.07136, 42.36107],
          [-71.07086, 42.36094],
          [-71.07076, 42.35947],
          [-71.07013, 42.35949],
          [-71.06994, 42.35881],
          [-71.06948, 42.3579],
          [-71.06628, 42.35831],
          [-71.06579, 42.35701],
          [-71.06443, 42.35733],
          [-71.06336, 42.35766],
          [-71.06275, 42.35791],
          [-71.06173, 42.35825],
          [-71.0615, 42.35828],
          [-71.05834, 42.35742],
          [-71.05809, 42.35766],
          [-71.05789, 42.35761],
          [-71.05753, 42.35758],
          [-71.05641, 42.35758],
          [-71.05633, 42.35682],
          [-71.05608, 42.35615],
          [-71.05595, 42.35592],
          [-71.05565, 42.35559],
          [-71.05412, 42.35415],
          [-71.05571, 42.35331],
          [-71.05591, 42.35313],
          [-71.05582, 42.35302],
          [-71.05552, 42.35282],
          [-71.05541, 42.35278],
          [-71.05559, 42.35256],
          [-71.05535, 42.35249],
          [-71.05524, 42.35229],
          [-71.0552, 42.3523]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:53:00Z",
  "durationMinutes": 23,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Bike 23 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const commuteWalk: Itinerary = {
  "id": "commute-walk",
  "legs": [
    {
      "id": "commute-walk-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616],
        "kind": "address"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523],
        "kind": "station"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T14:18:00Z",
      "durationMinutes": 48,
      "distanceMeters": 3587,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08829, 42.36245],
          [-71.08809, 42.36244],
          [-71.08808, 42.36248],
          [-71.08801, 42.36248],
          [-71.08518, 42.36226],
          [-71.08509, 42.36223],
          [-71.08418, 42.36215],
          [-71.08305, 42.36197],
          [-71.08021, 42.36176],
          [-71.08011, 42.36173],
          [-71.07983, 42.36173],
          [-71.07972, 42.3617],
          [-71.07954, 42.36171],
          [-71.07282, 42.3612],
          [-71.07213, 42.36113],
          [-71.07135, 42.361],
          [-71.07129, 42.36095],
          [-71.07112, 42.36092],
          [-71.07116, 42.36076],
          [-71.07095, 42.36072],
          [-71.07086, 42.35944],
          [-71.07018, 42.35946],
          [-71.06999, 42.35881],
          [-71.06997, 42.35878],
          [-71.06985, 42.35878],
          [-71.06946, 42.35798],
          [-71.06626, 42.35837],
          [-71.06619, 42.35827],
          [-71.06578, 42.35708],
          [-71.06515, 42.35722],
          [-71.06501, 42.35696],
          [-71.06479, 42.35694],
          [-71.06344, 42.35662],
          [-71.06273, 42.35643],
          [-71.06254, 42.35632],
          [-71.06241, 42.35644],
          [-71.06211, 42.35627],
          [-71.06213, 42.35625],
          [-71.0621, 42.35623],
          [-71.06057, 42.35551],
          [-71.06062, 42.35546],
          [-71.0602, 42.35521],
          [-71.05918, 42.35441],
          [-71.058, 42.3536],
          [-71.05791, 42.35349],
          [-71.0577, 42.35334],
          [-71.05685, 42.35316],
          [-71.05673, 42.35305],
          [-71.05648, 42.35293],
          [-71.05631, 42.3528],
          [-71.05606, 42.35269],
          [-71.05535, 42.35249],
          [-71.05524, 42.35229],
          [-71.0552, 42.3523]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T14:18:00Z",
  "durationMinutes": 48,
  "transfers": 0,
  "walkMinutes": 48,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 48 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const sampleDrive: Itinerary = {
  "id": "commute-drive",
  "legs": [
    {
      "id": "commute-drive-0",
      "mode": "car",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616],
        "kind": "address"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.0552, 42.3523],
        "kind": "station"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:40:00Z",
      "durationMinutes": 10,
      "distanceMeters": 5463,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.08766, 42.36001],
          [-71.08379, 42.36227],
          [-71.07086, 42.36094],
          [-71.06857, 42.36596],
          [-71.06294, 42.36773],
          [-71.05245, 42.35978],
          [-71.05136, 42.35599],
          [-71.05626, 42.35292],
          [-71.05508, 42.35246]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:40:00Z",
  "durationMinutes": 10,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 30.39,
    "lines": [
      {
        "label": "Gas",
        "usd": 0.39,
        "estimated": true
      },
      {
        "label": "Parking",
        "usd": 30,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Drive 10 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const flyFromBoston: Itinerary = {
  "id": "fly-bos",
  "legs": [
    {
      "id": "fly-bos-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "departAt": "2026-11-16T12:22:00Z",
      "arriveAt": "2026-11-16T12:29:00Z",
      "durationMinutes": 7,
      "distanceMeters": 429,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08829, 42.36245],
          [-71.08809, 42.36244],
          [-71.08808, 42.36248],
          [-71.08611, 42.36232],
          [-71.08612, 42.36215]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-bos-1",
      "mode": "rail",
      "from": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "departAt": "2026-11-16T12:29:00Z",
      "arriveAt": "2026-11-16T12:36:00Z",
      "durationMinutes": 7,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0856, 42.36235],
          [-71.08523, 42.36239],
          [-71.08343, 42.36213],
          [-71.07365, 42.36142],
          [-71.0706, 42.36116],
          [-71.06999, 42.36102],
          [-71.06934, 42.36074],
          [-71.06677, 42.35886],
          [-71.06586, 42.35812],
          [-71.06515, 42.35772],
          [-71.06029, 42.35532],
          [-71.05698, 42.35334],
          [-71.05517, 42.35256],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "fly-bos-2",
      "mode": "walk",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_84611"
      },
      "departAt": "2026-11-16T12:36:00Z",
      "arriveAt": "2026-11-16T12:38:00Z",
      "durationMinutes": 2,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05524, 42.35227],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-bos-3",
      "mode": "bus",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_84611"
      },
      "to": {
        "name": "Terminal B Stop 1 - Arrivals Level",
        "coordinates": [-71.01882, 42.3621],
        "kind": "stop",
        "code": "us-ma-MBTA_27092"
      },
      "departAt": "2026-11-16T12:38:00Z",
      "arriveAt": "2026-11-16T12:57:00Z",
      "durationMinutes": 19,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05524, 42.35227],
          [-71.05544, 42.35237],
          [-71.055, 42.35288],
          [-71.05485, 42.353],
          [-71.05375, 42.35356],
          [-71.05344, 42.35365],
          [-71.0531, 42.35365],
          [-71.04864, 42.35308],
          [-71.04808, 42.35299],
          [-71.04772, 42.35286],
          [-71.04497, 42.35156],
          [-71.04457, 42.35121],
          [-71.04408, 42.3506],
          [-71.04391, 42.3493],
          [-71.04375, 42.34904],
          [-71.04309, 42.34846],
          [-71.04274, 42.34829],
          [-71.03988, 42.34715],
          [-71.03963, 42.34711],
          [-71.03778, 42.34713],
          [-71.03765, 42.3471],
          [-71.03706, 42.3468],
          [-71.03805, 42.34577],
          [-71.03845, 42.34558],
          [-71.03886, 42.34554],
          [-71.03916, 42.3456],
          [-71.03931, 42.34566],
          [-71.0409, 42.34656],
          [-71.04272, 42.3474],
          [-71.04333, 42.34793],
          [-71.04401, 42.34831],
          [-71.04461, 42.34849],
          [-71.0452, 42.34855],
          [-71.04548, 42.34853],
          [-71.04569, 42.34848],
          [-71.04581, 42.34836],
          [-71.04581, 42.34822],
          [-71.04569, 42.3481],
          [-71.04449, 42.34801],
          [-71.04363, 42.34784],
          [-71.04033, 42.34683],
          [-71.03987, 42.34672],
          [-71.03948, 42.34665],
          [-71.03876, 42.34658],
          [-71.0377, 42.34659],
          [-71.03674, 42.34676],
          [-71.03587, 42.34702],
          [-71.03503, 42.34738],
          [-71.03363, 42.34812],
          [-71.03236, 42.34897],
          [-71.03184, 42.34937],
          [-71.03102, 42.35012],
          [-71.03044, 42.35074],
          [-71.03014, 42.35108],
          [-71.02969, 42.3517],
          [-71.029, 42.3528],
          [-71.02643, 42.35696],
          [-71.02574, 42.35828],
          [-71.0255, 42.35892],
          [-71.02529, 42.35966],
          [-71.02457, 42.36269],
          [-71.02439, 42.3642],
          [-71.02438, 42.36472],
          [-71.02444, 42.36548],
          [-71.02457, 42.36607],
          [-71.02512, 42.36769],
          [-71.02531, 42.36839],
          [-71.02554, 42.36872],
          [-71.02579, 42.3689],
          [-71.02608, 42.36903],
          [-71.02639, 42.3691],
          [-71.02689, 42.36909],
          [-71.02716, 42.36901],
          [-71.02739, 42.36888],
          [-71.02762, 42.36863],
          [-71.0277, 42.36837],
          [-71.02769, 42.36822],
          [-71.02765, 42.36806],
          [-71.02755, 42.36789],
          [-71.02727, 42.36766],
          [-71.02401, 42.36633],
          [-71.02251, 42.36585],
          [-71.02235, 42.36571],
          [-71.02232, 42.36537],
          [-71.02228, 42.3653],
          [-71.02219, 42.36525],
          [-71.02084, 42.36463],
          [-71.02086, 42.36461],
          [-71.02084, 42.36463],
          [-71.02016, 42.36434],
          [-71.01961, 42.36425],
          [-71.0194, 42.36413],
          [-71.01875, 42.36211],
          [-71.01882, 42.3621]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus SL1",
      "agency": "MBTA",
      "transferBufferMinutes": 2
    },
    {
      "id": "fly-bos-4",
      "mode": "walk",
      "from": {
        "name": "Terminal B Stop 1 - Arrivals Level",
        "coordinates": [-71.01882, 42.3621],
        "kind": "stop",
        "code": "us-ma-MBTA_27092"
      },
      "to": {
        "name": "Boston Logan (BOS)",
        "coordinates": [-71.0167, 42.3631]
      },
      "departAt": "2026-11-16T12:57:00Z",
      "arriveAt": "2026-11-16T13:00:00Z",
      "durationMinutes": 3,
      "distanceMeters": 87,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.01882, 42.3621],
          [-71.01778, 42.36229]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-bos-5",
      "mode": "flight",
      "from": {
        "name": "Boston Logan (BOS)",
        "coordinates": [-71.0052, 42.3656],
        "kind": "airport",
        "code": "BOS"
      },
      "to": {
        "name": "Orlando International (MCO)",
        "coordinates": [-81.3089, 28.4312],
        "kind": "airport",
        "code": "MCO"
      },
      "departAt": "2026-11-16T14:30:00Z",
      "arriveAt": "2026-11-16T17:35:00Z",
      "durationMinutes": 185,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0052, 42.3656],
          [-71.20076, 42.15227],
          [-71.39501, 41.93862],
          [-71.58797, 41.72464],
          [-71.77963, 41.51034],
          [-71.97004, 41.29572],
          [-72.15919, 41.08079],
          [-72.34711, 40.86555],
          [-72.53381, 40.65002],
          [-72.71931, 40.43418],
          [-72.90362, 40.21804],
          [-73.08676, 40.00162],
          [-73.26874, 39.78491],
          [-73.44958, 39.56792],
          [-73.62928, 39.35065],
          [-73.80788, 39.1331],
          [-73.98537, 38.91529],
          [-74.16177, 38.6972],
          [-74.33711, 38.47886],
          [-74.51138, 38.26025],
          [-74.6846, 38.04139],
          [-74.8568, 37.82227],
          [-75.02797, 37.60291],
          [-75.19814, 37.3833],
          [-75.36731, 37.16345],
          [-75.5355, 36.94336],
          [-75.70272, 36.72303],
          [-75.86898, 36.50247],
          [-76.0343, 36.28168],
          [-76.19868, 36.06066],
          [-76.36215, 35.83943],
          [-76.5247, 35.61797],
          [-76.68636, 35.39629],
          [-76.84712, 35.1744],
          [-77.00702, 34.9523],
          [-77.16605, 34.72999],
          [-77.32422, 34.50747],
          [-77.48155, 34.28476],
          [-77.63805, 34.06184],
          [-77.79373, 33.83872],
          [-77.9486, 33.61541],
          [-78.10267, 33.39191],
          [-78.25594, 33.16822],
          [-78.40844, 32.94434],
          [-78.56016, 32.72028],
          [-78.71113, 32.49603],
          [-78.86134, 32.27161],
          [-79.01081, 32.04701],
          [-79.15955, 31.82223],
          [-79.30757, 31.59729],
          [-79.45487, 31.37217],
          [-79.60147, 31.14689],
          [-79.74737, 30.92144],
          [-79.89259, 30.69582],
          [-80.03713, 30.47005],
          [-80.181, 30.24412],
          [-80.32421, 30.01803],
          [-80.46677, 29.79178],
          [-80.60869, 29.56539],
          [-80.74997, 29.33884],
          [-80.89062, 29.11215],
          [-81.03065, 28.88531],
          [-81.17008, 28.65833],
          [-81.3089, 28.4312]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "BOS → MCO (sample flight)",
      "transferBufferMinutes": 93
    },
    {
      "id": "fly-bos-6",
      "mode": "car",
      "from": {
        "name": "Orlando International (MCO)",
        "coordinates": [-81.3089, 28.4312],
        "kind": "airport",
        "code": "MCO"
      },
      "to": {
        "name": "Downtown Orlando",
        "coordinates": [-81.3731, 28.5432],
        "kind": "address"
      },
      "departAt": "2026-11-16T18:00:00Z",
      "arriveAt": "2026-11-16T18:24:00Z",
      "durationMinutes": 24,
      "distanceMeters": 20519,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-81.3089, 28.43067],
          [-81.31102, 28.4296],
          [-81.31032, 28.42734],
          [-81.30706, 28.42642],
          [-81.30539, 28.42886],
          [-81.30506, 28.43239],
          [-81.30793, 28.4385],
          [-81.30669, 28.44713],
          [-81.3099, 28.45636],
          [-81.31048, 28.53885],
          [-81.30948, 28.54038],
          [-81.33034, 28.53852],
          [-81.3684, 28.5385],
          [-81.36847, 28.54224],
          [-81.37307, 28.54225]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T12:22:00Z",
  "arriveAt": "2026-11-16T18:24:00Z",
  "durationMinutes": 362,
  "transfers": 2,
  "walkMinutes": 12,
  "cost": {
    "totalUsd": 233.1,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Bus SL1)",
        "usd": 1.7,
        "estimated": true
      },
      {
        "label": "Flight BOS → MCO (sample fare)",
        "usd": 189,
        "estimated": true
      },
      {
        "label": "Taxi MCO → downtown",
        "usd": 40,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 7 min → Red Line → walk 2 min → Bus SL1 → walk 3 min → BOS → MCO (sample flight) → drive 24 min",
  "source": {
    "provider": "sample flight + transitous/osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const flyFromProvidence: Itinerary = {
  "id": "fly-pvd",
  "legs": [
    {
      "id": "fly-pvd-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "departAt": "2026-11-16T14:08:00Z",
      "arriveAt": "2026-11-16T14:15:00Z",
      "durationMinutes": 7,
      "distanceMeters": 429,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08829, 42.36245],
          [-71.08809, 42.36244],
          [-71.08808, 42.36248],
          [-71.08611, 42.36232],
          [-71.08612, 42.36215]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-pvd-1",
      "mode": "rail",
      "from": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "departAt": "2026-11-16T14:15:00Z",
      "arriveAt": "2026-11-16T14:22:00Z",
      "durationMinutes": 7,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0856, 42.36235],
          [-71.08523, 42.36239],
          [-71.08343, 42.36213],
          [-71.07365, 42.36142],
          [-71.0706, 42.36116],
          [-71.06999, 42.36102],
          [-71.06934, 42.36074],
          [-71.06677, 42.35886],
          [-71.06586, 42.35812],
          [-71.06515, 42.35772],
          [-71.06029, 42.35532],
          [-71.05698, 42.35334],
          [-71.05517, 42.35256],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "fly-pvd-2",
      "mode": "walk",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05506, 42.3515],
        "kind": "stop",
        "code": "us-ma-MBTA_NEC-2287"
      },
      "departAt": "2026-11-16T14:22:00Z",
      "arriveAt": "2026-11-16T14:25:00Z",
      "durationMinutes": 3,
      "distanceMeters": 168,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05523, 42.35228],
          [-71.05501, 42.35232],
          [-71.0542, 42.35194],
          [-71.05462, 42.35141]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-pvd-3",
      "mode": "rail",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05506, 42.3515],
        "kind": "stop",
        "code": "us-ma-MBTA_NEC-2287"
      },
      "to": {
        "name": "TF Green Airport",
        "coordinates": [-71.44245, 41.7266],
        "kind": "stop",
        "code": "us-ma-MBTA_NEC-1768-03"
      },
      "departAt": "2026-11-16T14:25:00Z",
      "arriveAt": "2026-11-16T15:49:00Z",
      "durationMinutes": 84,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05506, 42.3515],
          [-71.05479, 42.35177],
          [-71.05489, 42.35153],
          [-71.05638, 42.34859],
          [-71.05696, 42.34762],
          [-71.05753, 42.34679],
          [-71.05765, 42.34665],
          [-71.05835, 42.34613],
          [-71.05874, 42.34594],
          [-71.05905, 42.34585],
          [-71.05965, 42.34579],
          [-71.06019, 42.34584],
          [-71.06455, 42.34678],
          [-71.06583, 42.34711],
          [-71.06689, 42.34727],
          [-71.069, 42.34749],
          [-71.07126, 42.34752],
          [-71.07371, 42.34752],
          [-71.07473, 42.34749],
          [-71.0756, 42.34739],
          [-71.076, 42.34727],
          [-71.0764, 42.34703],
          [-71.07806, 42.34573],
          [-71.07997, 42.34405],
          [-71.08055, 42.34363],
          [-71.08289, 42.34163],
          [-71.08535, 42.33968],
          [-71.08665, 42.33855],
          [-71.08799, 42.33748],
          [-71.08948, 42.33623],
          [-71.09015, 42.33572],
          [-71.09062, 42.3353],
          [-71.09292, 42.33341],
          [-71.09484, 42.33174],
          [-71.09544, 42.33111],
          [-71.0963, 42.33006],
          [-71.09711, 42.3289],
          [-71.09742, 42.32836],
          [-71.09816, 42.32666],
          [-71.09855, 42.32561],
          [-71.09893, 42.32444],
          [-71.09959, 42.32338],
          [-71.09993, 42.32275],
          [-71.10103, 42.3213],
          [-71.10278, 42.31922],
          [-71.10329, 42.31852],
          [-71.10401, 42.31735],
          [-71.10465, 42.31603],
          [-71.10523, 42.31458],
          [-71.10609, 42.31265],
          [-71.10725, 42.31059],
          [-71.11289, 42.30196],
          [-71.11732, 42.2955],
          [-71.11807, 42.29412],
          [-71.11855, 42.29302],
          [-71.11889, 42.29195],
          [-71.11905, 42.2912],
          [-71.11926, 42.28966],
          [-71.11941, 42.28806],
          [-71.11948, 42.28654],
          [-71.11953, 42.28176],
          [-71.11968, 42.28022],
          [-71.12069, 42.27532],
          [-71.12098, 42.2741],
          [-71.12141, 42.27196],
          [-71.12163, 42.2711],
          [-71.12205, 42.269],
          [-71.1224, 42.26751],
          [-71.12253, 42.26675],
          [-71.1244, 42.25813],
          [-71.12487, 42.25655],
          [-71.12526, 42.25562],
          [-71.12743, 42.25108],
          [-71.13142, 42.24291],
          [-71.13352, 42.23846],
          [-71.13579, 42.23388],
          [-71.13859, 42.228],
          [-71.13912, 42.22701],
          [-71.14882, 42.20684],
          [-71.14904, 42.20646],
          [-71.14996, 42.20458],
          [-71.15338, 42.1974],
          [-71.15427, 42.19561],
          [-71.15491, 42.19413],
          [-71.15524, 42.19307],
          [-71.15549, 42.19201],
          [-71.15558, 42.19132],
          [-71.15565, 42.19032],
          [-71.15564, 42.18953],
          [-71.15469, 42.17495],
          [-71.15392, 42.16423],
          [-71.15375, 42.16092],
          [-71.1538, 42.15984],
          [-71.15388, 42.15921],
          [-71.15414, 42.15794],
          [-71.15456, 42.15658],
          [-71.15505, 42.15551],
          [-71.15571, 42.15429],
          [-71.15649, 42.1532],
          [-71.15992, 42.14888],
          [-71.16101, 42.14756],
          [-71.16162, 42.14692],
          [-71.16217, 42.14637],
          [-71.16396, 42.14477],
          [-71.171, 42.13862],
          [-71.17215, 42.13756],
          [-71.17493, 42.13512],
          [-71.17551, 42.13459],
          [-71.17782, 42.13213],
          [-71.18153, 42.12788],
          [-71.18394, 42.1252],
          [-71.18504, 42.1239],
          [-71.18961, 42.1172],
          [-71.19028, 42.116],
          [-71.19064, 42.11524],
          [-71.19112, 42.11396],
          [-71.19133, 42.11316],
          [-71.19169, 42.11118],
          [-71.19176, 42.1105],
          [-71.19201, 42.109],
          [-71.19703, 42.07315],
          [-71.19724, 42.07181],
          [-71.19758, 42.0704],
          [-71.19796, 42.06932],
          [-71.19816, 42.06887],
          [-71.19946, 42.0663],
          [-71.20875, 42.04886],
          [-71.20991, 42.04691],
          [-71.22088, 42.0314],
          [-71.23328, 42.01398],
          [-71.23561, 42.01063],
          [-71.23636, 42.00962],
          [-71.25571, 41.98222],
          [-71.26188, 41.97355],
          [-71.30652, 41.91031],
          [-71.30721, 41.90939],
          [-71.30762, 41.90892],
          [-71.30822, 41.90832],
          [-71.30892, 41.90772],
          [-71.31008, 41.9069],
          [-71.31123, 41.90624],
          [-71.31235, 41.90572],
          [-71.31372, 41.90523],
          [-71.31489, 41.90491],
          [-71.31551, 41.90477],
          [-71.31798, 41.90432],
          [-71.33032, 41.90216],
          [-71.34035, 41.90036],
          [-71.35213, 41.89831],
          [-71.37933, 41.89347],
          [-71.37993, 41.89333],
          [-71.38077, 41.89306],
          [-71.382, 41.89256],
          [-71.38292, 41.89213],
          [-71.38354, 41.89173],
          [-71.38412, 41.89125],
          [-71.38444, 41.89088],
          [-71.38475, 41.8904],
          [-71.38496, 41.88991],
          [-71.38512, 41.88908],
          [-71.38547, 41.88512],
          [-71.38557, 41.88439],
          [-71.38567, 41.88397],
          [-71.38605, 41.88312],
          [-71.38635, 41.88271],
          [-71.38682, 41.8822],
          [-71.38741, 41.88168],
          [-71.38769, 41.88148],
          [-71.38834, 41.88104],
          [-71.38937, 41.88041],
          [-71.39157, 41.87909],
          [-71.39401, 41.87768],
          [-71.39683, 41.87581],
          [-71.39707, 41.87562],
          [-71.39745, 41.8752],
          [-71.39844, 41.87373],
          [-71.40026, 41.8707],
          [-71.4032, 41.86602],
          [-71.40455, 41.86371],
          [-71.40512, 41.86256],
          [-71.40542, 41.86181],
          [-71.40671, 41.85821],
          [-71.40718, 41.85723],
          [-71.40769, 41.8563],
          [-71.41087, 41.85139],
          [-71.41144, 41.85034],
          [-71.4127, 41.84779],
          [-71.41306, 41.84723],
          [-71.41371, 41.8464],
          [-71.41448, 41.84551],
          [-71.41484, 41.84502],
          [-71.41631, 41.84266],
          [-71.41676, 41.84152],
          [-71.41685, 41.84099],
          [-71.41689, 41.84015],
          [-71.4168, 41.83958],
          [-71.41663, 41.83907],
          [-71.41626, 41.83843],
          [-71.41402, 41.83501],
          [-71.41331, 41.83382],
          [-71.4129, 41.83305],
          [-71.41232, 41.83141],
          [-71.4122, 41.83079],
          [-71.41226, 41.83045],
          [-71.41235, 41.83022],
          [-71.41266, 41.8298],
          [-71.41296, 41.82948],
          [-71.41552, 41.82748],
          [-71.41637, 41.82721],
          [-71.41697, 41.8271],
          [-71.41929, 41.82694],
          [-71.42033, 41.82682],
          [-71.42263, 41.82644],
          [-71.42332, 41.82636],
          [-71.42397, 41.8263],
          [-71.42565, 41.82629],
          [-71.42671, 41.82619],
          [-71.43208, 41.82502],
          [-71.43326, 41.82462],
          [-71.43439, 41.82404],
          [-71.43496, 41.82364],
          [-71.43563, 41.82311],
          [-71.43613, 41.82263],
          [-71.43692, 41.82169],
          [-71.43898, 41.81846],
          [-71.43951, 41.81754],
          [-71.43962, 41.81728],
          [-71.43994, 41.81601],
          [-71.44189, 41.80733],
          [-71.44196, 41.8065],
          [-71.44186, 41.80585],
          [-71.44173, 41.80544],
          [-71.44124, 41.80464],
          [-71.44088, 41.80423],
          [-71.44015, 41.80362],
          [-71.43966, 41.80333],
          [-71.43934, 41.80318],
          [-71.43835, 41.80281],
          [-71.43082, 41.80026],
          [-71.43026, 41.8],
          [-71.42974, 41.79969],
          [-71.42947, 41.79948],
          [-71.42904, 41.79904],
          [-71.42873, 41.7986],
          [-71.4226, 41.7891],
          [-71.42209, 41.78801],
          [-71.42185, 41.78727],
          [-71.42172, 41.78664],
          [-71.42165, 41.78607],
          [-71.42166, 41.78513],
          [-71.42174, 41.78439],
          [-71.42194, 41.78356],
          [-71.42305, 41.78046],
          [-71.4239, 41.77737],
          [-71.44157, 41.72882],
          [-71.4424, 41.72655],
          [-71.44245, 41.7266]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Providence/Stoughton Line",
      "agency": "MBTA",
      "transferBufferMinutes": 3
    },
    {
      "id": "fly-pvd-4",
      "mode": "walk",
      "from": {
        "name": "TF Green Airport",
        "coordinates": [-71.44245, 41.7266],
        "kind": "stop",
        "code": "us-ma-MBTA_NEC-1768-03"
      },
      "to": {
        "name": "Providence T.F. Green (PVD)",
        "coordinates": [-71.4332, 41.7267]
      },
      "departAt": "2026-11-16T15:49:00Z",
      "arriveAt": "2026-11-16T16:03:00Z",
      "durationMinutes": 14,
      "distanceMeters": 828,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.4425, 41.72661],
          [-71.44222, 41.7274],
          [-71.44229, 41.72742],
          [-71.44227, 41.72747],
          [-71.44112, 41.72725],
          [-71.44106, 41.72723],
          [-71.44109, 41.72718],
          [-71.44096, 41.72716],
          [-71.44097, 41.72713],
          [-71.44025, 41.72699],
          [-71.44006, 41.72752],
          [-71.43919, 41.72735],
          [-71.43874, 41.72723],
          [-71.43843, 41.72723],
          [-71.43836, 41.7274],
          [-71.43828, 41.72742],
          [-71.43796, 41.72712],
          [-71.43788, 41.72709],
          [-71.43772, 41.72712],
          [-71.43771, 41.72717],
          [-71.43749, 41.72724],
          [-71.43732, 41.72719],
          [-71.43712, 41.7272],
          [-71.43697, 41.72736],
          [-71.43663, 41.72734],
          [-71.43661, 41.72739],
          [-71.43523, 41.72707],
          [-71.43519, 41.72717]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-pvd-5",
      "mode": "flight",
      "from": {
        "name": "Providence T.F. Green (PVD)",
        "coordinates": [-71.428, 41.724],
        "kind": "airport",
        "code": "PVD"
      },
      "to": {
        "name": "Orlando Sanford (SFB)",
        "coordinates": [-81.2375, 28.7776],
        "kind": "airport",
        "code": "SFB"
      },
      "departAt": "2026-11-16T17:33:00Z",
      "arriveAt": "2026-11-16T20:23:00Z",
      "durationMinutes": 170,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.428, 41.724],
          [-71.61155, 41.52554],
          [-71.79398, 41.32679],
          [-71.97529, 41.12775],
          [-72.15551, 40.92843],
          [-72.33464, 40.72883],
          [-72.5127, 40.52895],
          [-72.68971, 40.3288],
          [-72.86566, 40.12839],
          [-73.04058, 39.92771],
          [-73.21447, 39.72677],
          [-73.38736, 39.52557],
          [-73.55924, 39.32412],
          [-73.73014, 39.12241],
          [-73.90006, 38.92046],
          [-74.06902, 38.71826],
          [-74.23702, 38.51582],
          [-74.40408, 38.31314],
          [-74.5702, 38.11023],
          [-74.73541, 37.90708],
          [-74.89971, 37.70371],
          [-75.0631, 37.5001],
          [-75.22561, 37.29628],
          [-75.38724, 37.09223],
          [-75.548, 36.88796],
          [-75.7079, 36.68348],
          [-75.86695, 36.47879],
          [-76.02517, 36.27388],
          [-76.18255, 36.06877],
          [-76.33912, 35.86346],
          [-76.49488, 35.65794],
          [-76.64983, 35.45222],
          [-76.804, 35.24631],
          [-76.95739, 35.0402],
          [-77.11, 34.8339],
          [-77.26185, 34.62741],
          [-77.41294, 34.42073],
          [-77.56329, 34.21387],
          [-77.71291, 34.00682],
          [-77.86179, 33.79959],
          [-78.00996, 33.59219],
          [-78.15741, 33.38461],
          [-78.30416, 33.17686],
          [-78.45022, 32.96893],
          [-78.59559, 32.76084],
          [-78.74028, 32.55258],
          [-78.88431, 32.34416],
          [-79.02767, 32.13557],
          [-79.17037, 31.92682],
          [-79.31243, 31.71791],
          [-79.45385, 31.50885],
          [-79.59464, 31.29963],
          [-79.73481, 31.09025],
          [-79.87436, 30.88073],
          [-80.01329, 30.67106],
          [-80.15163, 30.46124],
          [-80.28937, 30.25127],
          [-80.42653, 30.04116],
          [-80.5631, 29.83091],
          [-80.6991, 29.62052],
          [-80.83453, 29.41],
          [-80.96941, 29.19933],
          [-81.10373, 28.98853],
          [-81.2375, 28.7776]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "PVD → SFB (sample flight)",
      "transferBufferMinutes": 104
    },
    {
      "id": "fly-pvd-6",
      "mode": "car",
      "from": {
        "name": "Orlando Sanford (SFB)",
        "coordinates": [-81.2375, 28.7776],
        "kind": "airport",
        "code": "SFB"
      },
      "to": {
        "name": "Downtown Orlando",
        "coordinates": [-81.3731, 28.5432],
        "kind": "address"
      },
      "departAt": "2026-11-16T20:48:00Z",
      "arriveAt": "2026-11-16T21:24:00Z",
      "durationMinutes": 36,
      "distanceMeters": 42777,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-81.23903, 28.77556],
          [-81.24006, 28.77227],
          [-81.23829, 28.7693],
          [-81.2385, 28.76226],
          [-81.24161, 28.75874],
          [-81.24456, 28.76047],
          [-81.26568, 28.76032],
          [-81.26942, 28.75682],
          [-81.26517, 28.74863],
          [-81.255, 28.73851],
          [-81.24573, 28.72375],
          [-81.22936, 28.69369],
          [-81.22611, 28.67951],
          [-81.22891, 28.66423],
          [-81.24562, 28.63061],
          [-81.24952, 28.62667],
          [-81.25672, 28.62381],
          [-81.25882, 28.62087],
          [-81.25821, 28.60976],
          [-81.2512, 28.60076],
          [-81.25005, 28.59677],
          [-81.25132, 28.59289],
          [-81.26405, 28.57687],
          [-81.2685, 28.56],
          [-81.268, 28.55668],
          [-81.26185, 28.55051],
          [-81.26171, 28.54873],
          [-81.27267, 28.54687],
          [-81.28476, 28.54109],
          [-81.29138, 28.53976],
          [-81.3684, 28.5385],
          [-81.36847, 28.54224],
          [-81.37307, 28.54225]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T14:08:00Z",
  "arriveAt": "2026-11-16T21:24:00Z",
  "durationMinutes": 436,
  "transfers": 2,
  "walkMinutes": 24,
  "cost": {
    "totalUsd": 181.05,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Providence/Stoughton Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Flight PVD → SFB (sample fare)",
        "usd": 99,
        "estimated": true
      },
      {
        "label": "Commuter rail to PVD",
        "usd": 12.25,
        "estimated": true
      },
      {
        "label": "Taxi SFB → downtown",
        "usd": 65,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "medium",
    "reasons": [
      "Depends on one commuter rail train (scheduled times)"
    ]
  },
  "violations": [],
  "summary": "Walk 7 min → Red Line → walk 3 min → Providence/Stoughton Line → walk 14 min → PVD → SFB (sample flight) → drive 36 min",
  "source": {
    "provider": "sample flight + transitous/osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const flyFromManchester: Itinerary = {
  "id": "fly-mht",
  "legs": [
    {
      "id": "fly-mht-0",
      "mode": "car",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616],
        "kind": "address"
      },
      "to": {
        "name": "Manchester-Boston (MHT)",
        "coordinates": [-71.4357, 42.9326],
        "kind": "airport",
        "code": "MHT"
      },
      "departAt": "2026-11-16T12:00:00Z",
      "arriveAt": "2026-11-16T13:14:00Z",
      "durationMinutes": 74,
      "distanceMeters": 83080,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.08766, 42.36001],
          [-71.08379, 42.36227],
          [-71.07086, 42.36094],
          [-71.06831, 42.36618],
          [-71.0643, 42.36596],
          [-71.06291, 42.36752],
          [-71.07526, 42.37715],
          [-71.0774, 42.38],
          [-71.07652, 42.38346],
          [-71.07764, 42.38648],
          [-71.09361, 42.39978],
          [-71.10331, 42.41111],
          [-71.10396, 42.41879],
          [-71.10226, 42.43401],
          [-71.10512, 42.44523],
          [-71.10205, 42.45703],
          [-71.10242, 42.46183],
          [-71.11656, 42.48317],
          [-71.1194, 42.50386],
          [-71.13485, 42.52339],
          [-71.13588, 42.52872],
          [-71.13489, 42.54214],
          [-71.13787, 42.55339],
          [-71.15344, 42.57922],
          [-71.1694, 42.59819],
          [-71.18122, 42.63577],
          [-71.20908, 42.69702],
          [-71.21076, 42.71412],
          [-71.20351, 42.7317],
          [-71.20473, 42.73809],
          [-71.21845, 42.7519],
          [-71.23283, 42.76095],
          [-71.24649, 42.77961],
          [-71.25175, 42.78247],
          [-71.26386, 42.78561],
          [-71.26885, 42.78908],
          [-71.27162, 42.79462],
          [-71.2706, 42.80565],
          [-71.27207, 42.80942],
          [-71.28447, 42.81687],
          [-71.29504, 42.83257],
          [-71.30417, 42.84048],
          [-71.31653, 42.85407],
          [-71.32236, 42.8575],
          [-71.33284, 42.86086],
          [-71.33718, 42.86396],
          [-71.34509, 42.88213],
          [-71.35942, 42.89549],
          [-71.37063, 42.91659],
          [-71.38066, 42.91783],
          [-71.38851, 42.91465],
          [-71.39409, 42.91401],
          [-71.39844, 42.91657],
          [-71.4045, 42.92448],
          [-71.41238, 42.92142],
          [-71.42208, 42.92302],
          [-71.42314, 42.91575],
          [-71.42505, 42.91441],
          [-71.44231, 42.91524],
          [-71.44449, 42.91649],
          [-71.44328, 42.92005],
          [-71.44589, 42.92432],
          [-71.44555, 42.92724],
          [-71.44426, 42.92808],
          [-71.43859, 42.92779],
          [-71.43771, 42.93197]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "fly-mht-1",
      "mode": "flight",
      "from": {
        "name": "Manchester-Boston (MHT)",
        "coordinates": [-71.4357, 42.9326],
        "kind": "airport",
        "code": "MHT"
      },
      "to": {
        "name": "Orlando International (MCO)",
        "coordinates": [-81.3089, 28.4312],
        "kind": "airport",
        "code": "MCO"
      },
      "departAt": "2026-11-16T14:44:00Z",
      "arriveAt": "2026-11-16T17:54:00Z",
      "durationMinutes": 190,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.4357, 42.9326],
          [-71.62495, 42.7097],
          [-71.81284, 42.48649],
          [-71.99939, 42.26297],
          [-72.18463, 42.03916],
          [-72.36856, 41.81504],
          [-72.55121, 41.59064],
          [-72.7326, 41.36595],
          [-72.91273, 41.14098],
          [-73.09164, 40.91573],
          [-73.26932, 40.6902],
          [-73.44581, 40.4644],
          [-73.62112, 40.23834],
          [-73.79525, 40.01202],
          [-73.96824, 39.78543],
          [-74.14009, 39.55859],
          [-74.31082, 39.3315],
          [-74.48044, 39.10416],
          [-74.64897, 38.87658],
          [-74.81642, 38.64875],
          [-74.98282, 38.42069],
          [-75.14816, 38.1924],
          [-75.31247, 37.96387],
          [-75.47576, 37.73512],
          [-75.63805, 37.50614],
          [-75.79934, 37.27694],
          [-75.95965, 37.04753],
          [-76.119, 36.8179],
          [-76.27739, 36.58806],
          [-76.43484, 36.35801],
          [-76.59136, 36.12776],
          [-76.74696, 35.8973],
          [-76.90167, 35.66664],
          [-77.05548, 35.43579],
          [-77.20841, 35.20475],
          [-77.36047, 34.97351],
          [-77.51168, 34.74208],
          [-77.66204, 34.51047],
          [-77.81156, 34.27867],
          [-77.96027, 34.0467],
          [-78.10816, 33.81454],
          [-78.25525, 33.58221],
          [-78.40155, 33.34971],
          [-78.54707, 33.11704],
          [-78.69183, 32.8842],
          [-78.83582, 32.65119],
          [-78.97907, 32.41802],
          [-79.12157, 32.18469],
          [-79.26335, 31.95119],
          [-79.40441, 31.71755],
          [-79.54476, 31.48374],
          [-79.6844, 31.24979],
          [-79.82336, 31.01568],
          [-79.96164, 30.78143],
          [-80.09924, 30.54703],
          [-80.23619, 30.31249],
          [-80.37247, 30.0778],
          [-80.50812, 29.84298],
          [-80.64312, 29.60802],
          [-80.7775, 29.37292],
          [-80.91126, 29.13768],
          [-81.04441, 28.90232],
          [-81.17695, 28.66682],
          [-81.3089, 28.4312]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "MHT → MCO (sample flight)"
    },
    {
      "id": "fly-mht-2",
      "mode": "car",
      "from": {
        "name": "Orlando International (MCO)",
        "coordinates": [-81.3089, 28.4312],
        "kind": "airport",
        "code": "MCO"
      },
      "to": {
        "name": "Downtown Orlando",
        "coordinates": [-81.3731, 28.5432],
        "kind": "address"
      },
      "departAt": "2026-11-16T18:19:00Z",
      "arriveAt": "2026-11-16T18:43:00Z",
      "durationMinutes": 24,
      "distanceMeters": 20519,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-81.3089, 28.43067],
          [-81.31102, 28.4296],
          [-81.31032, 28.42734],
          [-81.30706, 28.42642],
          [-81.30539, 28.42886],
          [-81.30506, 28.43239],
          [-81.30793, 28.4385],
          [-81.30669, 28.44713],
          [-81.3099, 28.45636],
          [-81.31048, 28.53885],
          [-81.30948, 28.54038],
          [-81.33034, 28.53852],
          [-81.3684, 28.5385],
          [-81.36847, 28.54224],
          [-81.37307, 28.54225]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T12:00:00Z",
  "arriveAt": "2026-11-16T18:43:00Z",
  "durationMinutes": 403,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 259.9,
    "lines": [
      {
        "label": "Flight MHT → MCO (sample fare)",
        "usd": 139,
        "estimated": true
      },
      {
        "label": "Gas",
        "usd": 5.9,
        "estimated": true
      },
      {
        "label": "Airport parking, 5 days",
        "usd": 75,
        "estimated": true
      },
      {
        "label": "Taxi MCO → downtown",
        "usd": 40,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Drive 74 min → MHT → MCO (sample flight) → drive 24 min",
  "source": {
    "provider": "sample flight + transitous/osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const airport0: Itinerary = {
  "id": "test-airport-transit",
  "legs": [
    {
      "id": "test-airport-transit-0",
      "mode": "walk",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616]
      },
      "to": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "departAt": "2026-11-16T13:42:00Z",
      "arriveAt": "2026-11-16T13:49:00Z",
      "durationMinutes": 7,
      "distanceMeters": 429,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.09035, 42.36162],
          [-71.09013, 42.36164],
          [-71.08996, 42.36169],
          [-71.08973, 42.36169],
          [-71.08974, 42.36172],
          [-71.08894, 42.36194],
          [-71.08843, 42.36241],
          [-71.08829, 42.36245],
          [-71.08809, 42.36244],
          [-71.08808, 42.36248],
          [-71.08611, 42.36232],
          [-71.08612, 42.36215]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-airport-transit-1",
      "mode": "rail",
      "from": {
        "name": "Kendall/MIT",
        "coordinates": [-71.0856, 42.36235],
        "kind": "stop",
        "code": "us-ma-MBTA_70071"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "departAt": "2026-11-16T13:49:00Z",
      "arriveAt": "2026-11-16T13:56:00Z",
      "durationMinutes": 7,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0856, 42.36235],
          [-71.08523, 42.36239],
          [-71.08343, 42.36213],
          [-71.07365, 42.36142],
          [-71.0706, 42.36116],
          [-71.06999, 42.36102],
          [-71.06934, 42.36074],
          [-71.06677, 42.35886],
          [-71.06586, 42.35812],
          [-71.06515, 42.35772],
          [-71.06029, 42.35532],
          [-71.05698, 42.35334],
          [-71.05517, 42.35256],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "test-airport-transit-2",
      "mode": "walk",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_70079"
      },
      "to": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_84611"
      },
      "departAt": "2026-11-16T13:56:00Z",
      "arriveAt": "2026-11-16T13:58:00Z",
      "durationMinutes": 2,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05524, 42.35227],
          [-71.05524, 42.35227]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-airport-transit-3",
      "mode": "bus",
      "from": {
        "name": "South Station",
        "coordinates": [-71.05524, 42.35227],
        "kind": "stop",
        "code": "us-ma-MBTA_84611"
      },
      "to": {
        "name": "Terminal A",
        "coordinates": [-71.02086, 42.36461],
        "kind": "stop",
        "code": "us-ma-MBTA_17091"
      },
      "departAt": "2026-11-16T13:58:00Z",
      "arriveAt": "2026-11-16T14:15:00Z",
      "durationMinutes": 17,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05524, 42.35227],
          [-71.05544, 42.35237],
          [-71.055, 42.35288],
          [-71.05485, 42.353],
          [-71.05375, 42.35356],
          [-71.05344, 42.35365],
          [-71.0531, 42.35365],
          [-71.04864, 42.35308],
          [-71.04808, 42.35299],
          [-71.04772, 42.35286],
          [-71.04497, 42.35156],
          [-71.04457, 42.35121],
          [-71.04408, 42.3506],
          [-71.04391, 42.3493],
          [-71.04375, 42.34904],
          [-71.04309, 42.34846],
          [-71.04274, 42.34829],
          [-71.03988, 42.34715],
          [-71.03963, 42.34711],
          [-71.03778, 42.34713],
          [-71.03765, 42.3471],
          [-71.03706, 42.3468],
          [-71.03796, 42.34585],
          [-71.03831, 42.34563],
          [-71.03857, 42.34556],
          [-71.03886, 42.34554],
          [-71.03916, 42.3456],
          [-71.03931, 42.34566],
          [-71.0409, 42.34656],
          [-71.04272, 42.3474],
          [-71.04333, 42.34793],
          [-71.04401, 42.34831],
          [-71.04461, 42.34849],
          [-71.0452, 42.34855],
          [-71.04548, 42.34853],
          [-71.04569, 42.34848],
          [-71.04581, 42.34836],
          [-71.04581, 42.34822],
          [-71.04569, 42.3481],
          [-71.04449, 42.34801],
          [-71.04363, 42.34784],
          [-71.04033, 42.34683],
          [-71.03987, 42.34672],
          [-71.03948, 42.34665],
          [-71.03876, 42.34658],
          [-71.0377, 42.34659],
          [-71.03674, 42.34676],
          [-71.03587, 42.34702],
          [-71.03503, 42.34738],
          [-71.03363, 42.34812],
          [-71.03236, 42.34897],
          [-71.03184, 42.34937],
          [-71.03102, 42.35012],
          [-71.03044, 42.35074],
          [-71.03014, 42.35108],
          [-71.02969, 42.3517],
          [-71.029, 42.3528],
          [-71.02643, 42.35696],
          [-71.02574, 42.35828],
          [-71.0255, 42.35892],
          [-71.02529, 42.35966],
          [-71.02457, 42.36269],
          [-71.02439, 42.3642],
          [-71.02438, 42.36472],
          [-71.02444, 42.36548],
          [-71.02457, 42.36607],
          [-71.02512, 42.36769],
          [-71.02531, 42.36839],
          [-71.02546, 42.36864],
          [-71.02579, 42.3689],
          [-71.02608, 42.36903],
          [-71.02639, 42.3691],
          [-71.02668, 42.36911],
          [-71.02703, 42.36905],
          [-71.02728, 42.36895],
          [-71.02753, 42.36875],
          [-71.02767, 42.3685],
          [-71.0277, 42.36837],
          [-71.02768, 42.36815],
          [-71.02755, 42.36789],
          [-71.02727, 42.36766],
          [-71.02401, 42.36633],
          [-71.02251, 42.36585],
          [-71.02235, 42.36571],
          [-71.02232, 42.36537],
          [-71.02228, 42.3653],
          [-71.02084, 42.36463],
          [-71.02086, 42.36461]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus SL1",
      "agency": "MBTA",
      "transferBufferMinutes": 2
    },
    {
      "id": "test-airport-transit-4",
      "mode": "walk",
      "from": {
        "name": "Terminal A",
        "coordinates": [-71.02086, 42.36461],
        "kind": "stop",
        "code": "us-ma-MBTA_17091"
      },
      "to": {
        "name": "Logan Airport, Terminal B",
        "coordinates": [-71.0201, 42.364]
      },
      "departAt": "2026-11-16T14:15:00Z",
      "arriveAt": "2026-11-16T14:17:00Z",
      "durationMinutes": 2,
      "distanceMeters": 68,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.02082, 42.3646],
          [-71.02093, 42.36446],
          [-71.02062, 42.36431],
          [-71.02038, 42.36429]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:42:00Z",
  "arriveAt": "2026-11-16T14:17:00Z",
  "durationMinutes": 35,
  "transfers": 1,
  "walkMinutes": 11,
  "cost": {
    "totalUsd": 4.1,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Bus SL1)",
        "usd": 1.7,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 7 min → Red Line → walk 2 min → Bus SL1 → walk 2 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const airport1: Itinerary = {
  "id": "test-airport-drive",
  "legs": [
    {
      "id": "test-airport-drive-0",
      "mode": "car",
      "from": {
        "name": "MIT Stata Center",
        "coordinates": [-71.0905, 42.3616],
        "kind": "address"
      },
      "to": {
        "name": "Logan Airport, Terminal B",
        "coordinates": [-71.0201, 42.364],
        "kind": "airport"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:44:00Z",
      "durationMinutes": 14,
      "distanceMeters": 8212,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.09048, 42.36157],
          [-71.08766, 42.36001],
          [-71.08379, 42.36227],
          [-71.07086, 42.36094],
          [-71.06894, 42.36563],
          [-71.06542, 42.36617],
          [-71.06348, 42.36778],
          [-71.0551, 42.36178],
          [-71.03718, 42.37373],
          [-71.03373, 42.37242],
          [-71.03007, 42.37373],
          [-71.02692, 42.37062],
          [-71.02597, 42.36736],
          [-71.01999, 42.36417]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:44:00Z",
  "durationMinutes": 14,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Drive 14 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const fenway0: Itinerary = {
  "id": "test-fenway-transit",
  "legs": [
    {
      "id": "test-fenway-transit-0",
      "mode": "walk",
      "from": {
        "name": "Harvard Square",
        "coordinates": [-71.119, 42.3734]
      },
      "to": {
        "name": "Harvard",
        "coordinates": [-71.11881, 42.37466],
        "kind": "stop",
        "code": "us-ma-MBTA_70067"
      },
      "departAt": "2026-11-16T13:42:00Z",
      "arriveAt": "2026-11-16T13:47:00Z",
      "durationMinutes": 5,
      "distanceMeters": 300,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.119, 42.3734],
          [-71.11909, 42.37339],
          [-71.11911, 42.37335],
          [-71.11929, 42.3734],
          [-71.11921, 42.37344],
          [-71.11937, 42.37356],
          [-71.11904, 42.37411],
          [-71.11902, 42.37433],
          [-71.11884, 42.37432],
          [-71.11882, 42.37446],
          [-71.11882, 42.37442],
          [-71.11885, 42.37442],
          [-71.11885, 42.37417],
          [-71.11884, 42.37403],
          [-71.11879, 42.37403],
          [-71.11879, 42.37467]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-fenway-transit-1",
      "mode": "rail",
      "from": {
        "name": "Harvard",
        "coordinates": [-71.11881, 42.37466],
        "kind": "stop",
        "code": "us-ma-MBTA_70067"
      },
      "to": {
        "name": "Central",
        "coordinates": [-71.10362, 42.3653],
        "kind": "stop",
        "code": "us-ma-MBTA_70069"
      },
      "departAt": "2026-11-16T13:47:00Z",
      "arriveAt": "2026-11-16T13:51:00Z",
      "durationMinutes": 4,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.11881, 42.37466],
          [-71.11868, 42.37442],
          [-71.11883, 42.37367],
          [-71.11884, 42.37351],
          [-71.11876, 42.37339],
          [-71.11848, 42.37327],
          [-71.11594, 42.37251],
          [-71.11422, 42.37101],
          [-71.113, 42.37004],
          [-71.11259, 42.36986],
          [-71.10986, 42.36884],
          [-71.10855, 42.36826],
          [-71.10781, 42.36789],
          [-71.10362, 42.3653]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "test-fenway-transit-2",
      "mode": "walk",
      "from": {
        "name": "Central",
        "coordinates": [-71.10362, 42.3653],
        "kind": "stop",
        "code": "us-ma-MBTA_70069"
      },
      "to": {
        "name": "Green St @ Magazine St",
        "coordinates": [-71.10441, 42.36494],
        "kind": "stop",
        "code": "us-ma-MBTA_1123"
      },
      "departAt": "2026-11-16T13:51:00Z",
      "arriveAt": "2026-11-16T13:53:00Z",
      "durationMinutes": 2,
      "distanceMeters": 205,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.10361, 42.36531],
          [-71.10428, 42.36571],
          [-71.10432, 42.36568],
          [-71.10423, 42.36563],
          [-71.10427, 42.36562],
          [-71.10435, 42.36567],
          [-71.10437, 42.36565],
          [-71.104, 42.3654],
          [-71.10422, 42.36526],
          [-71.10448, 42.36501],
          [-71.10439, 42.36496]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-fenway-transit-3",
      "mode": "bus",
      "from": {
        "name": "Green St @ Magazine St",
        "coordinates": [-71.10441, 42.36494],
        "kind": "stop",
        "code": "us-ma-MBTA_1123"
      },
      "to": {
        "name": "Park Dr @ Beacon St",
        "coordinates": [-71.10526, 42.34673],
        "kind": "stop",
        "code": "us-ma-MBTA_1775"
      },
      "departAt": "2026-11-16T13:55:00Z",
      "arriveAt": "2026-11-16T14:05:00Z",
      "durationMinutes": 10,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.10441, 42.36494],
          [-71.10444, 42.36491],
          [-71.10459, 42.365],
          [-71.10513, 42.3645],
          [-71.10374, 42.36364],
          [-71.10656, 42.36108],
          [-71.11146, 42.35649],
          [-71.11204, 42.35598],
          [-71.1106, 42.35518],
          [-71.11045, 42.35513],
          [-71.1103, 42.35512],
          [-71.11038, 42.35486],
          [-71.1107, 42.35463],
          [-71.11101, 42.35455],
          [-71.11117, 42.35447],
          [-71.11124, 42.35439],
          [-71.11126, 42.35429],
          [-71.11119, 42.35412],
          [-71.11089, 42.35384],
          [-71.11065, 42.35369],
          [-71.11053, 42.35351],
          [-71.11052, 42.3533],
          [-71.111, 42.35017],
          [-71.11091, 42.34993],
          [-71.11003, 42.3494],
          [-71.10907, 42.34888],
          [-71.10681, 42.34857],
          [-71.106, 42.34839],
          [-71.10518, 42.34675],
          [-71.10526, 42.34673]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus 47",
      "agency": "MBTA",
      "transferBufferMinutes": 4
    },
    {
      "id": "test-fenway-transit-4",
      "mode": "walk",
      "from": {
        "name": "Park Dr @ Beacon St",
        "coordinates": [-71.10526, 42.34673],
        "kind": "stop",
        "code": "us-ma-MBTA_1775"
      },
      "to": {
        "name": "Fenway Park",
        "coordinates": [-71.0972, 42.3467]
      },
      "departAt": "2026-11-16T14:05:00Z",
      "arriveAt": "2026-11-16T14:17:00Z",
      "durationMinutes": 12,
      "distanceMeters": 783,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.10531, 42.34674],
          [-71.1053, 42.34677],
          [-71.10505, 42.34684],
          [-71.10494, 42.34681],
          [-71.10211, 42.3476],
          [-71.10191, 42.34739],
          [-71.10138, 42.34754],
          [-71.10086, 42.34723],
          [-71.10083, 42.34718],
          [-71.10071, 42.34722],
          [-71.10065, 42.34729],
          [-71.10027, 42.3474],
          [-71.10015, 42.34739],
          [-71.09998, 42.34742],
          [-71.1, 42.34732],
          [-71.09993, 42.34731],
          [-71.09908, 42.34681],
          [-71.09872, 42.34715],
          [-71.09859, 42.34708],
          [-71.09853, 42.34713],
          [-71.0972, 42.34713]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:42:00Z",
  "arriveAt": "2026-11-16T14:17:00Z",
  "durationMinutes": 35,
  "transfers": 1,
  "walkMinutes": 19,
  "cost": {
    "totalUsd": 4.1,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Bus 47)",
        "usd": 1.7,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 5 min → Red Line → walk 2 min → Bus 47 → walk 12 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const fenway1: Itinerary = {
  "id": "test-fenway-drive",
  "legs": [
    {
      "id": "test-fenway-drive-0",
      "mode": "car",
      "from": {
        "name": "Harvard Square",
        "coordinates": [-71.119, 42.3734],
        "kind": "address"
      },
      "to": {
        "name": "Fenway Park",
        "coordinates": [-71.0972, 42.3467],
        "kind": "address"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:40:00Z",
      "durationMinutes": 10,
      "distanceMeters": 6069,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.11874, 42.37351],
          [-71.11802, 42.37591],
          [-71.11447, 42.37484],
          [-71.11729, 42.36916],
          [-71.11607, 42.36431],
          [-71.11818, 42.36416],
          [-71.11788, 42.35471],
          [-71.11278, 42.352],
          [-71.09311, 42.35059],
          [-71.09713, 42.34885],
          [-71.09858, 42.34718],
          [-71.0972, 42.34719]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:40:00Z",
  "durationMinutes": 10,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Drive 10 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const fenway2: Itinerary = {
  "id": "test-fenway-bike",
  "legs": [
    {
      "id": "test-fenway-bike-0",
      "mode": "bike",
      "from": {
        "name": "Harvard Square",
        "coordinates": [-71.119, 42.3734],
        "kind": "address"
      },
      "to": {
        "name": "Fenway Park",
        "coordinates": [-71.0972, 42.3467],
        "kind": "address"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:52:00Z",
      "durationMinutes": 22,
      "distanceMeters": 4780,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.119, 42.3734],
          [-71.11909, 42.37339],
          [-71.11911, 42.37335],
          [-71.11875, 42.37326],
          [-71.11935, 42.37226],
          [-71.11664, 42.37128],
          [-71.11612, 42.37112],
          [-71.11712, 42.36943],
          [-71.1171, 42.36928],
          [-71.11715, 42.36916],
          [-71.11732, 42.36904],
          [-71.11701, 42.36871],
          [-71.11666, 42.36813],
          [-71.11635, 42.36744],
          [-71.11611, 42.36673],
          [-71.11604, 42.36591],
          [-71.11615, 42.36451],
          [-71.11623, 42.36421],
          [-71.1162, 42.36235],
          [-71.11614, 42.36152],
          [-71.11603, 42.36109],
          [-71.11573, 42.35892],
          [-71.11565, 42.35851],
          [-71.11537, 42.35756],
          [-71.11492, 42.35684],
          [-71.11441, 42.35631],
          [-71.11358, 42.35574],
          [-71.11302, 42.35528],
          [-71.1118, 42.35459],
          [-71.11123, 42.35401],
          [-71.11067, 42.35364],
          [-71.1106, 42.35352],
          [-71.11051, 42.35348],
          [-71.11087, 42.35084],
          [-71.11102, 42.35027],
          [-71.11108, 42.3502],
          [-71.11164, 42.34757],
          [-71.10726, 42.34707],
          [-71.10381, 42.34802],
          [-71.10376, 42.34801],
          [-71.10293, 42.34631],
          [-71.1027, 42.3461],
          [-71.10228, 42.34631],
          [-71.10171, 42.34666],
          [-71.10115, 42.3469],
          [-71.10081, 42.3467],
          [-71.10062, 42.34653],
          [-71.09986, 42.34608],
          [-71.09974, 42.34608],
          [-71.09865, 42.34711],
          [-71.09859, 42.34708],
          [-71.09853, 42.34713],
          [-71.0972, 42.34713]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:52:00Z",
  "durationMinutes": 22,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Bike 22 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const ferry0: Itinerary = {
  "id": "test-ferry",
  "legs": [
    {
      "id": "test-ferry-0",
      "mode": "walk",
      "from": {
        "name": "Charlestown Navy Yard",
        "coordinates": [-71.0541, 42.3727]
      },
      "to": {
        "name": "Charlestown (Navy Yard)",
        "coordinates": [-71.05234, 42.3726],
        "kind": "stop",
        "code": "us-ma-MBTA_Boat-Charlestown"
      },
      "departAt": "2026-11-16T13:35:00Z",
      "arriveAt": "2026-11-16T13:45:00Z",
      "durationMinutes": 10,
      "distanceMeters": 607,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05387, 42.37304],
          [-71.05374, 42.37312],
          [-71.05384, 42.37324],
          [-71.05334, 42.37282],
          [-71.0533, 42.37285],
          [-71.05331, 42.37291],
          [-71.05474, 42.37415],
          [-71.05479, 42.37427],
          [-71.05476, 42.37438],
          [-71.05463, 42.37445],
          [-71.05445, 42.37444],
          [-71.05421, 42.37428],
          [-71.05322, 42.37342],
          [-71.05271, 42.37295],
          [-71.05273, 42.37292],
          [-71.05234, 42.3726]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-ferry-1",
      "mode": "ferry",
      "from": {
        "name": "Charlestown (Navy Yard)",
        "coordinates": [-71.05234, 42.3726],
        "kind": "stop",
        "code": "us-ma-MBTA_Boat-Charlestown"
      },
      "to": {
        "name": "Long Wharf (South)",
        "coordinates": [-71.05048, 42.35945],
        "kind": "stop",
        "code": "us-ma-MBTA_Boat-Long-South"
      },
      "departAt": "2026-11-16T13:45:00Z",
      "arriveAt": "2026-11-16T13:55:00Z",
      "durationMinutes": 10,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05234, 42.3726],
          [-71.05252, 42.37273],
          [-71.05254, 42.37257],
          [-71.05249, 42.37246],
          [-71.05202, 42.37171],
          [-71.05173, 42.37137],
          [-71.05067, 42.37046],
          [-71.0483, 42.36874],
          [-71.04767, 42.36815],
          [-71.04735, 42.36766],
          [-71.04459, 42.36114],
          [-71.04452, 42.3609],
          [-71.04452, 42.36055],
          [-71.04457, 42.36046],
          [-71.04482, 42.36021],
          [-71.04509, 42.36002],
          [-71.04556, 42.35983],
          [-71.04588, 42.35978],
          [-71.04758, 42.35974],
          [-71.04905, 42.35967],
          [-71.05048, 42.35945]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Charlestown Ferry",
      "agency": "MBTA"
    },
    {
      "id": "test-ferry-2",
      "mode": "walk",
      "from": {
        "name": "Long Wharf (South)",
        "coordinates": [-71.05048, 42.35945],
        "kind": "stop",
        "code": "us-ma-MBTA_Boat-Long-South"
      },
      "to": {
        "name": "Long Wharf",
        "coordinates": [-71.0503, 42.36]
      },
      "departAt": "2026-11-16T13:55:00Z",
      "arriveAt": "2026-11-16T13:58:00Z",
      "durationMinutes": 3,
      "distanceMeters": 175,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.0505, 42.35945],
          [-71.05053, 42.35953],
          [-71.05072, 42.35965],
          [-71.05099, 42.35962],
          [-71.05108, 42.35965],
          [-71.05123, 42.3598],
          [-71.05116, 42.35981],
          [-71.05119, 42.35994],
          [-71.05032, 42.36008]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:35:00Z",
  "arriveAt": "2026-11-16T13:58:00Z",
  "durationMinutes": 23,
  "transfers": 0,
  "walkMinutes": 13,
  "cost": {
    "totalUsd": 2.4,
    "lines": [
      {
        "label": "Fare (Charlestown Ferry)",
        "usd": 2.4,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 10 min → Charlestown Ferry → walk 3 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const ferry1: Itinerary = {
  "id": "test-ferry-walk",
  "legs": [
    {
      "id": "test-ferry-walk-0",
      "mode": "walk",
      "from": {
        "name": "Charlestown Navy Yard",
        "coordinates": [-71.0541, 42.3727],
        "kind": "address"
      },
      "to": {
        "name": "Long Wharf",
        "coordinates": [-71.0503, 42.36],
        "kind": "address"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T14:05:00Z",
      "durationMinutes": 35,
      "distanceMeters": 2629,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05359, 42.37303],
          [-71.05472, 42.37397],
          [-71.05513, 42.3744],
          [-71.05584, 42.37396],
          [-71.05598, 42.37409],
          [-71.05654, 42.37374],
          [-71.05679, 42.37358],
          [-71.05681, 42.37344],
          [-71.0576, 42.37296],
          [-71.05766, 42.3728],
          [-71.05773, 42.37274],
          [-71.0602, 42.37159],
          [-71.06047, 42.37195],
          [-71.06052, 42.37197],
          [-71.0615, 42.37131],
          [-71.06156, 42.37122],
          [-71.06156, 42.37114],
          [-71.06147, 42.37104],
          [-71.0612, 42.37087],
          [-71.06094, 42.37061],
          [-71.05997, 42.36923],
          [-71.05969, 42.3689],
          [-71.05957, 42.36867],
          [-71.05865, 42.36735],
          [-71.05858, 42.36728],
          [-71.05844, 42.36723],
          [-71.05845, 42.36711],
          [-71.0583, 42.36696],
          [-71.05833, 42.36691],
          [-71.0574, 42.36588],
          [-71.05715, 42.36341],
          [-71.05695, 42.36332],
          [-71.05669, 42.36325],
          [-71.05594, 42.36281],
          [-71.05581, 42.36267],
          [-71.05559, 42.3626],
          [-71.05555, 42.36251],
          [-71.05492, 42.36219],
          [-71.05481, 42.3621],
          [-71.05392, 42.36167],
          [-71.05391, 42.36163],
          [-71.05288, 42.36107],
          [-71.0526, 42.36097],
          [-71.05258, 42.36089],
          [-71.05233, 42.36066],
          [-71.05192, 42.36018],
          [-71.05174, 42.35985],
          [-71.05032, 42.36008]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T14:05:00Z",
  "durationMinutes": 35,
  "transfers": 0,
  "walkMinutes": 35,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 35 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const bikeRail0: Itinerary = {
  "id": "test-bike-rail",
  "legs": [
    {
      "id": "test-bike-rail-0",
      "mode": "bike",
      "from": {
        "name": "Central Square",
        "coordinates": [-71.1036, 42.3653]
      },
      "to": {
        "name": "Stuart St @ Dartmouth St",
        "coordinates": [-71.07622, 42.34824],
        "kind": "stop",
        "code": "us-ma-MBTA_71855"
      },
      "departAt": "2026-11-16T13:38:00Z",
      "arriveAt": "2026-11-16T13:53:00Z",
      "durationMinutes": 15,
      "distanceMeters": 3615,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.10357, 42.36533],
          [-71.09587, 42.36076],
          [-71.09443, 42.35986],
          [-71.09387, 42.35939],
          [-71.09355, 42.35902],
          [-71.09323, 42.35849],
          [-71.09289, 42.35779],
          [-71.09286, 42.35762],
          [-71.0924, 42.3568],
          [-71.08909, 42.35007],
          [-71.08086, 42.35228],
          [-71.079, 42.34849],
          [-71.07869, 42.34783],
          [-71.07867, 42.3477],
          [-71.07839, 42.34784],
          [-71.07794, 42.34797],
          [-71.07627, 42.34835]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-bike-rail-1",
      "mode": "bus",
      "from": {
        "name": "Stuart St @ Dartmouth St",
        "coordinates": [-71.07622, 42.34824],
        "kind": "stop",
        "code": "us-ma-MBTA_71855"
      },
      "to": {
        "name": "Lincoln St @ Essex St",
        "coordinates": [-71.05799, 42.35219],
        "kind": "stop",
        "code": "us-ma-MBTA_6550"
      },
      "departAt": "2026-11-16T13:53:00Z",
      "arriveAt": "2026-11-16T14:02:00Z",
      "durationMinutes": 9,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07622, 42.34824],
          [-71.07626, 42.34833],
          [-71.07501, 42.34868],
          [-71.074, 42.34905],
          [-71.06815, 42.35063],
          [-71.06687, 42.35095],
          [-71.06615, 42.35109],
          [-71.06592, 42.35111],
          [-71.06492, 42.35108],
          [-71.06241, 42.35083],
          [-71.06155, 42.35063],
          [-71.05974, 42.3501],
          [-71.05895, 42.34992],
          [-71.05822, 42.3517],
          [-71.05805, 42.3522],
          [-71.05799, 42.35219]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Bus 501",
      "agency": "MBTA"
    },
    {
      "id": "test-bike-rail-2",
      "mode": "walk",
      "from": {
        "name": "Lincoln St @ Essex St",
        "coordinates": [-71.05799, 42.35219],
        "kind": "stop",
        "code": "us-ma-MBTA_6550"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.0603, 42.3555]
      },
      "departAt": "2026-11-16T14:02:00Z",
      "arriveAt": "2026-11-16T14:09:00Z",
      "durationMinutes": 7,
      "distanceMeters": 489,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05799, 42.3522],
          [-71.05793, 42.35225],
          [-71.05789, 42.35224],
          [-71.05768, 42.35234],
          [-71.05779, 42.35255],
          [-71.05785, 42.35254],
          [-71.05787, 42.35264],
          [-71.05778, 42.35325],
          [-71.0577, 42.35334],
          [-71.05791, 42.35349],
          [-71.058, 42.3536],
          [-71.05918, 42.35441],
          [-71.05986, 42.35495],
          [-71.05974, 42.35507],
          [-71.06032, 42.35549]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:38:00Z",
  "arriveAt": "2026-11-16T14:09:00Z",
  "durationMinutes": 31,
  "transfers": 0,
  "walkMinutes": 7,
  "cost": {
    "totalUsd": 1.7,
    "lines": [
      {
        "label": "Fare (Bus 501)",
        "usd": 1.7,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Bike 15 min → Bus 501 → walk 7 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const bikeRail1: Itinerary = {
  "id": "test-bike-direct",
  "legs": [
    {
      "id": "test-bike-direct-0",
      "mode": "bike",
      "from": {
        "name": "Central Square",
        "coordinates": [-71.1036, 42.3653],
        "kind": "address"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.0603, 42.3555],
        "kind": "address"
      },
      "departAt": "2026-11-16T13:30:00Z",
      "arriveAt": "2026-11-16T13:53:00Z",
      "durationMinutes": 23,
      "distanceMeters": 4320,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.10357, 42.36533],
          [-71.10317, 42.36509],
          [-71.10232, 42.36585],
          [-71.09841, 42.36352],
          [-71.09835, 42.36346],
          [-71.09836, 42.36333],
          [-71.09025, 42.36272],
          [-71.08994, 42.36272],
          [-71.08834, 42.36257],
          [-71.08812, 42.36258],
          [-71.08708, 42.36251],
          [-71.08506, 42.36233],
          [-71.08418, 42.3622],
          [-71.08402, 42.3622],
          [-71.08379, 42.36227],
          [-71.0834, 42.36214],
          [-71.08271, 42.36201],
          [-71.07293, 42.36126],
          [-71.07136, 42.36107],
          [-71.07086, 42.36094],
          [-71.07076, 42.35947],
          [-71.07013, 42.35949],
          [-71.06994, 42.35881],
          [-71.06948, 42.3579],
          [-71.06628, 42.35831],
          [-71.06579, 42.35701],
          [-71.0646, 42.35728],
          [-71.06321, 42.35772],
          [-71.06278, 42.35725],
          [-71.06198, 42.35651],
          [-71.06226, 42.35627],
          [-71.06129, 42.35581],
          [-71.06132, 42.35578],
          [-71.06055, 42.35542],
          [-71.06049, 42.3554],
          [-71.06033, 42.35548]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:30:00Z",
  "arriveAt": "2026-11-16T13:53:00Z",
  "durationMinutes": 23,
  "transfers": 0,
  "walkMinutes": 0,
  "cost": {
    "totalUsd": 0,
    "lines": []
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Bike 23 min",
  "source": {
    "provider": "osrm (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const roundTrip0: Itinerary = {
  "id": "test-commute-out",
  "legs": [
    {
      "id": "test-commute-out-0",
      "mode": "walk",
      "from": {
        "name": "Davis Square",
        "coordinates": [-71.1218, 42.3967]
      },
      "to": {
        "name": "Davis",
        "coordinates": [-71.12182, 42.39674],
        "kind": "stop",
        "code": "us-ma-MBTA_70063"
      },
      "departAt": "2026-11-16T13:32:00Z",
      "arriveAt": "2026-11-16T13:33:00Z",
      "durationMinutes": 1,
      "distanceMeters": 4,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.1218, 42.3967],
          [-71.12182, 42.39674]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-commute-out-1",
      "mode": "rail",
      "from": {
        "name": "Davis",
        "coordinates": [-71.12182, 42.39674],
        "kind": "stop",
        "code": "us-ma-MBTA_70063"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05942, 42.35467],
        "kind": "stop",
        "code": "us-ma-MBTA_70077"
      },
      "departAt": "2026-11-16T13:33:00Z",
      "arriveAt": "2026-11-16T13:50:00Z",
      "durationMinutes": 17,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.12182, 42.39674],
          [-71.12186, 42.39667],
          [-71.12157, 42.39659],
          [-71.1212, 42.39644],
          [-71.12063, 42.39617],
          [-71.12003, 42.39584],
          [-71.11969, 42.39561],
          [-71.11933, 42.3952],
          [-71.11924, 42.39496],
          [-71.11915, 42.39363],
          [-71.11883, 42.39062],
          [-71.11894, 42.38818],
          [-71.12009, 42.37803],
          [-71.12006, 42.37772],
          [-71.1199, 42.37722],
          [-71.11968, 42.3767],
          [-71.11943, 42.37646],
          [-71.11876, 42.3761],
          [-71.11852, 42.37586],
          [-71.11848, 42.37572],
          [-71.11848, 42.37549],
          [-71.11853, 42.37497],
          [-71.11883, 42.37367],
          [-71.11884, 42.37351],
          [-71.11876, 42.37339],
          [-71.11848, 42.37327],
          [-71.11594, 42.37251],
          [-71.11422, 42.37101],
          [-71.113, 42.37004],
          [-71.11259, 42.36986],
          [-71.10986, 42.36884],
          [-71.10855, 42.36826],
          [-71.10781, 42.36789],
          [-71.10403, 42.36554],
          [-71.10133, 42.36396],
          [-71.10099, 42.36377],
          [-71.10049, 42.36355],
          [-71.09954, 42.36344],
          [-71.09491, 42.36311],
          [-71.09181, 42.36285],
          [-71.08675, 42.36253],
          [-71.08523, 42.36239],
          [-71.08343, 42.36213],
          [-71.07531, 42.36155],
          [-71.07045, 42.36114],
          [-71.06982, 42.36096],
          [-71.06934, 42.36074],
          [-71.06677, 42.35886],
          [-71.06586, 42.35812],
          [-71.06515, 42.35772],
          [-71.06029, 42.35532],
          [-71.05942, 42.35467]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA"
    },
    {
      "id": "test-commute-out-2",
      "mode": "walk",
      "from": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05942, 42.35467],
        "kind": "stop",
        "code": "us-ma-MBTA_70077"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.06101, 42.35511],
        "kind": "stop",
        "code": "us-ma-MBTA_70020"
      },
      "departAt": "2026-11-16T13:50:00Z",
      "arriveAt": "2026-11-16T13:52:00Z",
      "durationMinutes": 2,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05942, 42.35467],
          [-71.06101, 42.35511]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-commute-out-3",
      "mode": "rail",
      "from": {
        "name": "Downtown Crossing",
        "coordinates": [-71.06101, 42.35511],
        "kind": "stop",
        "code": "us-ma-MBTA_70020"
      },
      "to": {
        "name": "Back Bay",
        "coordinates": [-71.07573, 42.34735],
        "kind": "stop",
        "code": "us-ma-MBTA_70014"
      },
      "departAt": "2026-11-16T13:52:00Z",
      "arriveAt": "2026-11-16T13:56:00Z",
      "durationMinutes": 4,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.061, 42.35511],
          [-71.06103, 42.35492],
          [-71.0623, 42.35362],
          [-71.06244, 42.35328],
          [-71.06253, 42.35243],
          [-71.06286, 42.35097],
          [-71.06299, 42.35074],
          [-71.06332, 42.35045],
          [-71.06392, 42.34983],
          [-71.06411, 42.34907],
          [-71.0642, 42.34899],
          [-71.06734, 42.34754],
          [-71.06753, 42.34748],
          [-71.06787, 42.34747],
          [-71.06898, 42.34757],
          [-71.0716, 42.3476],
          [-71.07357, 42.34759],
          [-71.07471, 42.34756],
          [-71.07511, 42.34752],
          [-71.07558, 42.34746],
          [-71.07579, 42.3474],
          [-71.07573, 42.34735]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Orange Line",
      "agency": "MBTA",
      "transferBufferMinutes": 2
    },
    {
      "id": "test-commute-out-4",
      "mode": "walk",
      "from": {
        "name": "Back Bay",
        "coordinates": [-71.07573, 42.34735],
        "kind": "stop",
        "code": "us-ma-MBTA_70014"
      },
      "to": {
        "name": "Back Bay",
        "coordinates": [-71.0758, 42.3474]
      },
      "departAt": "2026-11-16T13:56:00Z",
      "arriveAt": "2026-11-16T13:57:00Z",
      "durationMinutes": 1,
      "distanceMeters": 5,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07576, 42.34761],
          [-71.07582, 42.3476]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T13:32:00Z",
  "arriveAt": "2026-11-16T13:57:00Z",
  "durationMinutes": 25,
  "transfers": 1,
  "walkMinutes": 4,
  "cost": {
    "totalUsd": 4.8,
    "lines": [
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Orange Line)",
        "usd": 2.4,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 1 min → Red Line → walk 2 min → Orange Line → walk 1 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

export const roundTrip1: Itinerary = {
  "id": "test-commute-back",
  "legs": [
    {
      "id": "test-commute-back-0",
      "mode": "walk",
      "from": {
        "name": "Back Bay",
        "coordinates": [-71.0758, 42.3474]
      },
      "to": {
        "name": "Back Bay",
        "coordinates": [-71.07573, 42.34735],
        "kind": "stop",
        "code": "us-ma-MBTA_70015"
      },
      "departAt": "2026-11-16T22:30:00Z",
      "arriveAt": "2026-11-16T22:31:00Z",
      "durationMinutes": 1,
      "distanceMeters": 11,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07583, 42.34739],
          [-71.07581, 42.34734],
          [-71.07573, 42.34736]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-commute-back-1",
      "mode": "rail",
      "from": {
        "name": "Back Bay",
        "coordinates": [-71.07573, 42.34735],
        "kind": "stop",
        "code": "us-ma-MBTA_70015"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05997, 42.35588],
        "kind": "stop",
        "code": "us-ma-MBTA_70021"
      },
      "departAt": "2026-11-16T22:31:00Z",
      "arriveAt": "2026-11-16T22:36:00Z",
      "durationMinutes": 5,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.07573, 42.34735],
          [-71.07578, 42.3474],
          [-71.07558, 42.34746],
          [-71.07511, 42.34752],
          [-71.07471, 42.34756],
          [-71.07357, 42.34759],
          [-71.0716, 42.3476],
          [-71.06898, 42.34757],
          [-71.06787, 42.34747],
          [-71.06753, 42.34748],
          [-71.06734, 42.34754],
          [-71.0642, 42.34899],
          [-71.06411, 42.34907],
          [-71.06392, 42.34983],
          [-71.06332, 42.35045],
          [-71.06299, 42.35074],
          [-71.06286, 42.35097],
          [-71.06253, 42.35243],
          [-71.06244, 42.35328],
          [-71.0623, 42.35362],
          [-71.06103, 42.35492],
          [-71.05997, 42.35588]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Orange Line",
      "agency": "MBTA"
    },
    {
      "id": "test-commute-back-2",
      "mode": "walk",
      "from": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05997, 42.35588],
        "kind": "stop",
        "code": "us-ma-MBTA_70021"
      },
      "to": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05937, 42.35476],
        "kind": "stop",
        "code": "us-ma-MBTA_70078"
      },
      "departAt": "2026-11-16T22:36:00Z",
      "arriveAt": "2026-11-16T22:38:00Z",
      "durationMinutes": 2,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05997, 42.35588],
          [-71.05937, 42.35476]
        ]
      },
      "timeSource": "estimated"
    },
    {
      "id": "test-commute-back-3",
      "mode": "rail",
      "from": {
        "name": "Downtown Crossing",
        "coordinates": [-71.05937, 42.35476],
        "kind": "stop",
        "code": "us-ma-MBTA_70078"
      },
      "to": {
        "name": "Davis",
        "coordinates": [-71.12182, 42.39674],
        "kind": "stop",
        "code": "us-ma-MBTA_70064"
      },
      "departAt": "2026-11-16T22:38:00Z",
      "arriveAt": "2026-11-16T22:56:00Z",
      "durationMinutes": 18,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.05937, 42.35476],
          [-71.06029, 42.35532],
          [-71.06548, 42.3579],
          [-71.06586, 42.35812],
          [-71.06677, 42.35886],
          [-71.06934, 42.36074],
          [-71.06982, 42.36096],
          [-71.07045, 42.36114],
          [-71.07531, 42.36155],
          [-71.08343, 42.36213],
          [-71.08523, 42.36239],
          [-71.08675, 42.36253],
          [-71.09181, 42.36285],
          [-71.09491, 42.36311],
          [-71.09954, 42.36344],
          [-71.10049, 42.36355],
          [-71.10099, 42.36377],
          [-71.10133, 42.36396],
          [-71.10403, 42.36554],
          [-71.10781, 42.36789],
          [-71.10855, 42.36826],
          [-71.10986, 42.36884],
          [-71.11259, 42.36986],
          [-71.113, 42.37004],
          [-71.11422, 42.37101],
          [-71.11594, 42.37251],
          [-71.11848, 42.37327],
          [-71.11876, 42.37339],
          [-71.11884, 42.37351],
          [-71.11883, 42.37367],
          [-71.11853, 42.37497],
          [-71.11848, 42.37549],
          [-71.11848, 42.37572],
          [-71.11852, 42.37586],
          [-71.11876, 42.3761],
          [-71.11943, 42.37646],
          [-71.11968, 42.3767],
          [-71.1199, 42.37722],
          [-71.12006, 42.37772],
          [-71.12009, 42.37803],
          [-71.11894, 42.38818],
          [-71.11883, 42.39062],
          [-71.11915, 42.39363],
          [-71.11924, 42.39496],
          [-71.11933, 42.3952],
          [-71.11969, 42.39561],
          [-71.12003, 42.39584],
          [-71.12063, 42.39617],
          [-71.1212, 42.39644],
          [-71.12157, 42.39659],
          [-71.12186, 42.39667],
          [-71.12182, 42.39674]
        ]
      },
      "timeSource": "scheduled",
      "routeName": "Red Line",
      "agency": "MBTA",
      "transferBufferMinutes": 2
    },
    {
      "id": "test-commute-back-4",
      "mode": "walk",
      "from": {
        "name": "Davis",
        "coordinates": [-71.12182, 42.39674],
        "kind": "stop",
        "code": "us-ma-MBTA_70064"
      },
      "to": {
        "name": "Davis Square",
        "coordinates": [-71.1218, 42.3967]
      },
      "departAt": "2026-11-16T22:56:00Z",
      "arriveAt": "2026-11-16T22:57:00Z",
      "durationMinutes": 1,
      "distanceMeters": 4,
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-71.12182, 42.39674],
          [-71.1218, 42.3967]
        ]
      },
      "timeSource": "estimated"
    }
  ],
  "departAt": "2026-11-16T22:30:00Z",
  "arriveAt": "2026-11-16T22:57:00Z",
  "durationMinutes": 27,
  "transfers": 1,
  "walkMinutes": 4,
  "cost": {
    "totalUsd": 4.8,
    "lines": [
      {
        "label": "Fare (Orange Line)",
        "usd": 2.4,
        "estimated": true
      },
      {
        "label": "Fare (Red Line)",
        "usd": 2.4,
        "estimated": true
      }
    ]
  },
  "risk": {
    "level": "low",
    "reasons": []
  },
  "violations": [],
  "summary": "Walk 1 min → Orange Line → walk 2 min → Red Line → walk 1 min",
  "source": {
    "provider": "transitous (recorded)",
    "fetchedAt": "2026-11-14T05:00:00Z"
  }
};

/**
 * Scenario 1: the same trip by transit and by car. The bike and walk versions above are kept in this
 * file but left out of the demo (mode choice is the UI team's job); add them back here if needed.
 */
export const commuteOptions: Itinerary[] = [sampleItinerary, commuteBus, sampleDrive];

/** Scenario 2: Boston area to Orlando, flying from three airports into two (MCO, SFB). */
export const flightOptions: Itinerary[] = [flyFromBoston, flyFromProvidence, flyFromManchester];

/** Used by the tests. */
export const sampleItineraries: Itinerary[] = commuteOptions;

/** Harder real trips for checking the map on a phone, at most 3 trips per scenario. */
export const testScenarios: Record<string, Itinerary[]> = {
  airport: [airport0, airport1],
  fenway: [fenway0, fenway1, fenway2],
  ferry: [ferry0, ferry1],
  bikeRail: [bikeRail0, bikeRail1],
  roundTrip: [roundTrip0, roundTrip1]
};
