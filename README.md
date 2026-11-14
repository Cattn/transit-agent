# Transit Agent

React web, React Native mobile, and a shared Node API in an npm workspace. Starter screens cover Flight, Commute, Biking, and Agent. Trip planning integrations are ready to be implemented.

## Quick start

Use Node.js 24.13+ and npm 11.8+. From the repository root:

```sh
npm install
npm run dev
```

This builds and watches shared code and starts the API, web app, and Expo together. Open http://localhost:5173 for web. The API listens on http://localhost:3001/api/health. Scan the Expo terminal QR code with Expo Go on your phone.

## Workspace

- `apps/web`: React + Vite with a development proxy for `/api`.
- `apps/mobile`: Expo + React Native for Android and iOS.
- `apps/server`: Fastify API with request logging, CORS, and graceful shutdown.
- `packages/shared`: API types, planning sections, and an API client used by both apps.
- `packages/maps`: the route map (`@transit/maps`). Draws `Itinerary[]` on MapLibre; see [`packages/maps/README.md`](packages/maps/README.md) for how to put a route on the map.

Keep reusable types and platform-independent logic in `packages/shared/src`. Each client owns its platform UI. Shared output is compiled into `packages/shared/dist`; `npm run dev` rebuilds it automatically.

## Commands

- `npm run dev`: run everything with shared-package watching.
- `npm run dev:web`, `npm run dev:server`, `npm run dev:mobile`: run individual apps after `npm run build:shared`.
- `npm run demo:maps`: the route map demo with sample routes at http://localhost:5180. No server or build needed.
- `npm run android`: open Expo Go on an Android emulator or connected Android phone.
- `npm run ios`: open an iOS simulator on macOS.
- `npm run mobile:tunnel`: expose the Expo development server through a tunnel.
- `npm test`: lint, type-check, and run Vitest unit tests (`packages/shared`, `apps/server`). Run `npm run test:unit` for tests only.
- `npm run smoke`: build the API and check health, section responses, and CORS without opening a port.
- `npm run build`: compile shared/server code, build web, and export Android/iOS JavaScript bundles.
- `npm run check`: run validation, all builds, and API smoke checks.
- `npm run mobile:doctor`: check Expo compatibility.

Every workspace also has `test`, `typecheck`, and `build` scripts. Use `npm run <script> -w @transit/<web|mobile|server|shared>` to run one independently. Build shared code first.

Mobile export checks JavaScript bundling; installable native apps use EAS Build below.

## Environment

Copy the relevant app's `.env.example` to `.env` when overriding defaults. Restart after changing variables.

- Server: `HOST` defaults to `0.0.0.0`, `PORT` to `3001`, and `CORS_ORIGIN` to `http://localhost:5173`. Multiple browser origins can be comma-separated.
- Web: leave `VITE_API_URL` empty for the local proxy. Set the deployed API URL before a production build, or configure your host to proxy `/api`.
- Mobile: `EXPO_PUBLIC_API_URL` must be reachable from the device. Android emulators default to `http://10.0.2.2:3001`; iOS simulators default to `http://localhost:3001`.

Client environment variables are public. Keep provider keys and secrets on the server.

## Mobile platform helpers

`apps/mobile/src/platform` holds the phone-only pieces screens share:
- `getApiUrl()` picks the API address: `EXPO_PUBLIC_API_URL` if set, else the LAN address Expo serves from (works on a real phone), else the emulator/simulator default.
- `secureStoreDeviceIdStorage` keeps the anonymous device ID in the OS keychain/keystore.
- `getCurrentPlace()` is "use my location". It asks for permission only when called, and only for when-in-use location; the app never requests background location.
- `useAppForeground()` lets screens pause polling while the app is in the background.

These use `expo-secure-store`, `expo-location` and `expo-constants`. Expo Go already includes them, but a development build must be rebuilt (`npm run build:android`, and `npm run build:ios` for iPhone) after pulling this change or any new permission text in `app.json`. Run the pure helpers' tests with `npm run test:unit -w @transit/mobile`.

## Test on your Android phone

1. Install [Expo Go](https://expo.dev/go) and put your phone and PC on the same Wi-Fi.
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env`. Set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:3001`. Run `ipconfig` to find your PC's Wi-Fi IPv4 address.
3. Run `npm run dev`, allow Node through Windows Firewall on your private network if prompted, and scan the Expo QR code in Expo Go.
4. The home screen should show **Server connected**. Check `http://YOUR_PC_LAN_IP:3001/api/health` in the phone browser if needed.

If Wi-Fi fails, stop Expo and run `npm run mobile:tunnel`. The Expo tunnel only carries the app bundle: the API still needs a reachable LAN address or its own HTTPS deployment/tunnel. If Expo Go reports an SDK mismatch, use the Android build linked at [expo.dev/go](https://expo.dev/go) for SDK 58 or an EAS development build.

## Android emulator on Windows

1. Install [Android Studio](https://developer.android.com/studio).
2. In SDK Manager, install an Android SDK platform, Android SDK Platform-Tools, and Android Emulator.
3. In Device Manager, create a virtual Pixel with a Google Play system image and start it. Enable hardware virtualization and Windows Hypervisor Platform if requested.
4. Set the Windows user variable `ANDROID_HOME` to `%LOCALAPPDATA%\Android\Sdk`. Add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to your user `Path`, then restart your terminal.
5. Run `npm run android:setup` to list available emulators and connected devices.
6. Leave `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` in `apps/mobile/.env`. Run `npm run dev`, then press `a` in Expo, or run `npm run android` while the API is running.

For a USB phone, enable Developer options and USB debugging, approve the PC connection, and check `adb devices`. Run `adb reverse tcp:3001 tcp:3001` and set the mobile API URL to `http://localhost:3001`, or use your PC's LAN address.

See [Expo's Android environment guide](https://docs.expo.dev/get-started/set-up-your-environment/?device=simulated&mode=expo-go&platform=android).

## Cloud builds and installable APKs

[EAS Build](https://docs.expo.dev/build/introduction/) builds native apps without installing Android build tools locally. An Expo account is required. From the root:

```sh
npm run build:shared
cd apps/mobile
npx eas-cli@27.10.0 login
npx eas-cli@27.10.0 init
npm run build:preview
```

`eas init` links your Expo project and writes its project ID into app config. The first interactive build configures signing credentials. Commit the resulting project configuration. Replace `com.transitagent.app` in `app.json` with your own application ID before publishing.

- `preview` produces an installable Android APK that runs without Metro. Set a reachable API URL before building. For hosted builds, configure it with `npx eas-cli@27.10.0 env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR_API_HOST --visibility plaintext`.
- `development` includes Expo's dev client. Run `npm run build:android`, install the APK, then `npm run dev:client`. Rebuild when adding native dependencies.
- `production` produces store builds. iOS device builds require Apple signing credentials; local iOS simulation requires macOS and Xcode. EAS can build iOS from Windows.

See [installable APK builds](https://docs.expo.dev/build-reference/apk/) and [development builds](https://docs.expo.dev/tutorial/eas/configure-development-build/).

## GitHub Actions

`ci.yml` runs lint, type checks, web/server builds, Android/iOS bundle exports, and API smoke checks on pushes and pull requests. Outputs are uploaded as a seven-day artifact. Deploy the server with its workspace dependencies and built shared package, not only its `dist` folder; web `dist` is standalone static output.

`android.yml` manually queues a cloud APK build. First link the Expo project and complete an interactive Android build to create signing credentials. Set repository secret `EXPO_TOKEN` to an Expo access token and repository variable `EXPO_PUBLIC_API_URL` to your HTTPS API. Run **Android preview APK** from Actions. The job prints the EAS build link; it does not wait for native compilation or publish to a store.

Use Node.js 24.13+ and npm 11.8+. Set GEMINI_API_KEY only on the server to enable the planner, or use Vertex AI with Application Default Credentials: `GOOGLE_GENAI_USE_ENTERPRISE=true` (the older `GOOGLE_GENAI_USE_VERTEXAI=true` also works), `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION` (see `apps/server/.env.example`). AGENT_MODEL_PLANNER overrides GEMINI_MODEL; the default is gemini-3.8-flash. AGENT_THINKING_PLANNER sets the planner's thinking level (LOW by default; MEDIUM or HIGH).

### Shared development server

For occasional live AI/API tests, Cattn can run the API with `HOST=0.0.0.0`, `PORT=3001`, and a server-only `GEMINI_API_KEY`. Set `CORS_ORIGIN` to the actual teammate browser origins, comma-separated (local web commonly uses `http://localhost:5173`). Start the API with `npm run dev:server` after setting those variables in its environment. Teammates do not need Gemini credentials.

Teammates set `VITE_API_URL=http://HOST_LAN_IP:3001` for web or `EXPO_PUBLIC_API_URL=http://HOST_LAN_IP:3001` for mobile, replacing `HOST_LAN_IP` with the API host's LAN address. Restart clients after changing environment variables and check `http://HOST_LAN_IP:3001/api/health`. The LAN must be reachable. Off-network access needs a separately arranged network or tunnel; an Expo bundle tunnel does not provide API access.

Mocks and fakes remain the default development path, and CI never calls Gemini. Enabling live Gemini does not enable live transit or flight providers.
