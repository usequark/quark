# Quark Mobile App

Expo-based mobile client for Quark projects.

## Quick Start

```bash
# 1. Start the backend (web + worker) from project root
pnpm dev

# 2. In a second terminal — start the mobile app
cd apps/mobile
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000' > .env
npx expo start
```

## Review on MacBook (Android Emulator)

Requires [Android Studio](https://developer.android.com/studio) with an AVD created.

```bash
# First time only: install dependencies + generate native dirs
npx expo prebuild --platform android

# Run on Android emulator
npx expo run:android

# Subsequent runs (fast — reuses build cache)
npx expo run:android
```

Hot reload works out of the box. Shake menu (`Cmd+M`) to open dev tools.

## Review on Physical Android Phone

### Option A: Expo Go (quickest, no build)

1. Install **Expo Go** from the Play Store
2. Run `npx expo start` and scan the QR code
3. Limitation: `expo-secure-store` and `expo-notifications` behave differently in Expo Go — use for UI/layout review only

### Option B: Development Build (full fidelity)

```bash
# First time: generate native dirs + install on device via USB
npx expo prebuild --platform android
npx expo run:android --device

# Or use EAS Build for a wireless install
npx eas build --profile development --platform android
# Download the .apk from the EAS dashboard, install on phone
```

Development builds support all native modules (`expo-secure-store`, `expo-notifications`) identically to production.

## Commands Reference

### Development

| Command | What it does |
|---|---|
| `npx expo start` | Start Metro bundler (JS only, fastest) |
| `npx expo start --clear` | Start with cleared cache |
| `npx expo run:android` | Build + run on Android emulator/device |
| `npx expo run:android --device` | Build + run on connected physical device |
| `npx expo start --tunnel` | Expose local server over the internet (for testing on phone without same WiFi) |

### Production Builds

| Command | What it does |
|---|---|
| `npx eas build --profile production --platform android` | Build release APK/AAB for Play Store |
| `npx eas build --profile production --platform ios` | Build release IPA for App Store |
| `npx eas build --platform all` | Build both platforms |

### OTA Updates

| Command | What it does |
|---|---|
| `npx eas update --channel staging` | Push JS changes to staging channel |
| `npx eas update --channel production` | Push JS changes to production (live users) |

OTA is instant — no app store review needed for JS-only changes. See `CHECKLIST.md` for what qualifies.

### Scripts (from project root)

| Command | What it does |
|---|---|
| `pnpm dev` | Start web + worker (API on :3000) |
| `pnpm build:mobile` | Export mobile app for preview |

## Environment

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Backend API URL (e.g. `http://localhost:3000` or `https://your-app.quark.dev`) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Optional | Google Sign-In client ID |

Set in `apps/mobile/.env`. The `EXPO_PUBLIC_` prefix is required by Expo for client-side access.

## Architecture

- **Expo Router v55** — File-based routing
- **expo-secure-store** — Secure token storage (never AsyncStorage)
- **Zod** — All validation at system boundaries
- **fetch** — HTTP client with auth injection + automatic 401 retry

## Auth Flow

1. Sign in via `/api/auth/token` → receives JWT + refresh token
2. Tokens stored in `expo-secure-store`
3. API calls include `Authorization: Bearer <token>` header
4. On 401, token refresh attempted via `/api/auth/refresh`
5. On refresh failure, auth cleared and user redirected to sign-in

## Push Notifications

- Token registered on app launch after authentication
- APNs (iOS) and FCM (Android) handled server-side via worker jobs
- No Firebase SDK on client or server

## Deep Linking

Configure your URL scheme in `app.json` under `expo.scheme`. Expo Router handles file-based deep linking automatically.

## OTA Updates

Configured via `expo-updates`. Channels: `development` → `staging` → `production`.

See `CHECKLIST.md` for OTA vs store build decisions.
