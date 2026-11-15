# Transit Agent

A trip planner for Boston that you can talk to. Describe a trip in plain language, or search for it directly, and Transit Agent plans door-to-door routes across bus, train, bike and car, draws them on a map, and watches saved trips so it can tell you when to leave.

- **Map first.** Routes are drawn on a full-screen map; saved trips keep their own colours.
- **Agent.** A Gemini planner turns a request into a trip, searches, and explains the best option while you watch it work.
- **Watched trips.** Saved trips refresh in the background with leave-by times and live delays.
- **Place shortcuts.** Home, Office and Gym plan a trip in one tap.

Android is the primary platform (Expo with Material 3 Compose controls). iOS runs but is not yet designed; the web app is a lower priority. Flight comparisons are planned.

## Quick start

Requires Node.js 24.13+ and npm 11.8+.

```sh
npm install
npm run dev
```

This starts the API (http://localhost:3001), the web app (http://localhost:5173) and Expo; scan the Expo QR code with [Expo Go](https://expo.dev/go). By default everything runs on fixture data, with no API keys or external calls.

With an Android phone connected over USB:

```sh
npm run phone        # app on the phone, using the API on this machine
npm run phone:mock   # app on the phone with built-in sample data, no server
```

## Repository

| Path | Contents |
| --- | --- |
| `apps/mobile` | Expo app: map, search and filters, results, agent chat, saved trips, settings |
| `apps/server` | Fastify API: trip planning, place search, the agent, profiles, saved trips and the watch job |
| `apps/web` | React + Vite client |
| `packages/shared` | Schemas, types, formatting and the API client, including a mock client |
| `packages/client-react` | React hooks for the API client |
| `packages/maps` | The MapLibre route map, shared by web and mobile ([documentation](packages/maps/README.md)) |
| `plans/` | Implementation plans; the source of truth for what is being built ([index](plans/README.md)) |

Platform-independent logic belongs in `packages/shared`; each app owns its UI. Shared packages compile to `dist/`, which `npm run dev` rebuilds automatically.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run all apps with shared packages in watch mode |
| `npm run dev:server`, `dev:web`, `dev:mobile` | Run one app (after `npm run build:packages`) |
| `npm run demo:maps` | Route map demo at http://localhost:5180 |
| `npm run check` | Lint, type-check, test, build everything and run the API smoke test. Required before pushing |
| `npm test` | Lint, type-check and unit tests |
| `npm run build` | Build all apps and export the Android and iOS bundles |

Each workspace also has `test`, `typecheck` and `build` scripts: `npm run <script> -w @transit/<name>`.

## Configuration

Copy an app's `.env.example` to `.env` to override defaults. Client variables are public; keep keys on the server.

**Server** (`apps/server/.env`)

| Variable | Purpose |
| --- | --- |
| `ROUTE_PROVIDERS` | `fixture` (default) or `transitous` for live routing. Transitous also requires `ROUTING_USER_AGENT` with a contact address |
| `GEMINI_API_KEY` | Enables the AI planner. Vertex AI works instead: `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` |
| `GEMINI_MODEL`, `AGENT_MODEL_PLANNER`, `AGENT_THINKING_PLANNER` | Planner model (default `gemini-3.8-flash`) and thinking level (`LOW`, `MEDIUM`, `HIGH`) |
| `PHOTON_URL` | Photon place search; unset uses a built-in place list |
| `MBTA_API_KEY` | Optional; raises the MBTA live-prediction rate limit |
| `WATCH_ENABLED`, `WATCH_INTERVAL_SECONDS` | Background refresh of watched trips (on, every 60 s) |
| `DATABASE_PATH` | SQLite file for profiles and saved trips |
| `HOST`, `PORT`, `CORS_ORIGIN` | Defaults `0.0.0.0`, `3001`, `http://localhost:5173` |

See `apps/server/.env.example` for the full list. CI never calls Gemini, and enabling it does not enable live transit data.

**Web:** `VITE_API_URL` is empty for the local `/api` proxy; set it for production builds.
**Mobile:** `EXPO_PUBLIC_API_URL` must be reachable from the device. Without it, the app uses Expo's LAN address, or the emulator or simulator default.

## Testing on devices

| Command | Description |
| --- | --- |
| `npm run phone`, `phone:mock` | USB Android phone in Expo Go, against this machine's API or sample data |
| `npm run phone:apk` | Install the latest release APK over USB and connect it to this machine |
| `npm run host` | Serve the API on the local network, with a QR code for `<server>/connect` |
| `npm run host:public` | Also expose it over HTTPS (Tailscale Funnel or cloudflared) |
| `npm run share` | `host:public` plus the Expo dev server over a tunnel |

Testers open `<server>/connect` on their phone to install the APK and connect it to that server; the app remembers the choice. On Windows, allow Node.js through the firewall for private networks so phones on Wi-Fi can reach the API. For emulators, see [Expo's environment guide](https://docs.expo.dev/get-started/set-up-your-environment/) and run `npm run android:setup`.

## Contributing

- Start from the relevant plan in [`plans/`](plans/README.md); GitHub issues mirror them.
- `npm run check` must pass before pushing.
- Pull requests are reviewed against the house rules: no new code comments, no removed logging, new test cases go in existing test files, and no AI attribution in commits.
- Changes to a screen include screenshots or video of each main feature on Android, in light and dark mode.
