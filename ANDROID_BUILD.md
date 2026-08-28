# Building the Android app (Capacitor)

The web app is wrapped with [Capacitor](https://capacitorjs.com/). The native
project lives in `android/` and is checked into git; `dist/` is copied into it by
`npx cap sync` and is **not** committed.

## One-time setup on your machine

1. Install **Android Studio** (bundles the Android SDK + an emulator).
2. Install a **JDK 21** (Android Studio ships one under
   `…/Android Studio/jbr` — pointing `JAVA_HOME` at that is enough).
3. First launch of Android Studio: let it install the SDK and accept licenses.

## Every time you change the web app

```bash
npm run cap:sync      # build + copy web assets into android/
```

Then in Android Studio press **Run** (device or emulator), or from the CLI:

```bash
npm run android       # build + sync + open Android Studio
```

## Producing an APK

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
The debug APK lands in
`android/app/build/outputs/apk/debug/app-debug.apk`.

For a shareable release build you'll need to generate a signing keystore
(**Build → Generate Signed Bundle / APK**) and keep the `.jks` file out of git.

## Config

`capacitor.config.ts` at the repo root:

- `appId`: `com.experiments.planttracker`
- `appName`: `Plant Experiments`
- `webDir`: `dist`

Changing `appId` later means regenerating `android/` (`npx cap add android`).
