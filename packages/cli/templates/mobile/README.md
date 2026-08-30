# Quark Mobile App

Expo-based mobile client for Quark projects.

## Setup

```bash
# Install dependencies
pnpm install

# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android
```

## Environment

Set `EXPO_PUBLIC_API_URL` in your `.env` file:

```
EXPO_PUBLIC_API_URL=https://your-app.quark.dev
```

## Architecture

- **Expo Router v4** - File-based routing
- **Zustand** - Lightweight state management
- **expo-secure-store** - Secure token storage (never AsyncStorage)
- **Zod** - All validation at system boundaries
- **fetch** - HTTP client with auth injection

## Auth Flow

1. Sign in via `/api/auth/token` → receives JWT + refresh token
2. Tokens stored in expo-secure-store
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
