# OTA vs Store Build Checklist

Use this checklist to determine whether a change can be deployed via OTA update or requires a new store build.

## OTA Update (expo-updates)

Changes that CAN be delivered via OTA:
- JavaScript/TypeScript code changes
- Asset updates (images, fonts, colors)
- Route structure changes (file-based routing)
- API endpoint URL changes
- UI component updates
- Bug fixes in existing features

## Store Build Required

Changes that CANNOT be delivered via OTA:
- Native module additions or removals
- `app.json` / `app.config.js` changes to native config
- New expo plugin additions
- Changes to `expo-notifications` plugin config
- iOS entitlement changes
- Android permission changes
- React Native version upgrades
- Expo SDK major version upgrades

## How to Check

1. Run `git diff` on `package.json`
2. If native dependencies changed → store build needed
3. If only JS/TS files changed → OTA is safe
4. Test OTA on staging channel before production

## CI Integration

```bash
# Check for native dependency changes
git diff origin/main...HEAD -- package.json | grep -E "^\+.*(expo-|react-native)"
# If output exists, block OTA and require store build
```
