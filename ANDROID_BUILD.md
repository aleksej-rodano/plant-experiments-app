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

## Native behaviour wired in

- **Hardware back button** (`@capacitor/app`) — deep screens step back one
  route; the top-level tabs fall back to Experiments; pressing back on
  Experiments exits the app. See `src/lib/native/useAndroidBackButton.ts`.
- **Status bar + splash screen** (`@capacitor/status-bar`,
  `@capacitor/splash-screen`) — themed dark green to match the header; the
  splash is hidden by `initNative()` in `src/lib/native/index.ts` once React
  mounts (`launchAutoHide: false` in `capacitor.config.ts`).
- All of `src/lib/native/` is a no-op in the browser, so `npm run dev` and the
  hosted web build are unaffected.
- **Photos** already open the camera via the webview file picker. Switching to
  the native `@capacitor/camera` plugin is an optional later step.

After pulling these changes, run `npm run cap:sync` once so the new plugins are
registered in `android/`.

## Config

`capacitor.config.ts` at the repo root:

- `appId`: `com.experiments.planttracker`
- `appName`: `Plant Experiments`
- `webDir`: `dist`
- `plugins.SplashScreen`: manual hide, dark-green background

Changing `appId` later means regenerating `android/` (`npx cap add android`).
