# PondiFarm Mobile

Expo / React Native client for the PondiFarmApp pipeline. Communicates with the FastAPI backend and presents the capture → measurement → result flow.

## Stack

- Expo SDK 54
- React Native 0.81.5
- React 19.1
- TypeScript 5.9
- React Navigation 7 (native stack + bottom tabs)
- `expo-camera`, `expo-image-picker`, `expo-file-system`, `expo-haptics`
- `react-native-svg`, `@react-native-async-storage/async-storage`

## Project structure

```
mobile/
├── App.tsx               Root component
├── index.ts              Entry point
├── app.json              Expo configuration
├── eas.json              EAS Build profiles
├── babel.config.js
├── tsconfig.json
├── package.json
└── src/                  Application code
```

## Local development

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Start the dev server

```bash
npx expo start
```

Open the project on a device using the Expo Go app, or press `i` to launch an iOS simulator and `a` to launch an Android emulator.

### 3. Type-check and lint

```bash
npx tsc --noEmit
npx expo lint
```

## Connecting to the backend

By default the app expects the backend at `http://localhost:8000`. For physical-device testing, use the LAN IP of the machine running the FastAPI service.

## EAS Build

`eas.json` defines three profiles: `development`, `preview`, and `production`. Production profile is currently empty and must be completed before publishing builds to the stores.

> **Migration note:** The Expo project (`extra.eas.projectId` and `updates.url`) currently references the predecessor `boviscan` project owned by `tcord`. A new EAS project under the Euro Union Consult account must be created and the IDs updated before the first official EAS Update.

## Permissions

The app declares the following runtime permissions:

- Camera (capture and live preview)
- Photo library (selecting an existing image)
- Microphone (reserved for future audio annotations during capture)

User-facing permission strings remain in Portuguese, matching the target end-user language. Code, commit messages, and documentation remain in English.

## Licence

See the repository root [`LICENSE`](../LICENSE) for the proprietary terms that govern this code.
