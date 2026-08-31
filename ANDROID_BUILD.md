# Building the Android app (Capacitor)

The web app is wrapped with [Capacitor](https://capacitorjs.com/). The native
project lives in `android/` and is checked into git; `dist/` is copied into it by
`npx cap sync` and is **not** committed.

## One-time setup on your machine

1. Install **Android Studio** (bundles the Android SDK + an emulator). On first
   launch let its Setup Wizard install the SDK and accept the licenses.
2. Open the `android/` folder in Android Studio once (**File → Open →** pick
   `android/`). Let the Gradle sync finish — it downloads Gradle, the Android
   Gradle Plugin, and provisions a **JDK 21** under `~/.jdks/`. When prompted for
   the Gradle JVM, choose **"Use JVM 21"**.
3. For **command-line** builds (`npm run apk`), the wrapper script needs
   `JAVA_HOME`. Set it once to the JDK Studio downloaded, e.g. on Windows:

   ```powershell
   setx JAVA_HOME "$env:USERPROFILE\.jdks\jbr-21.0.11"
   ```

   (Adjust the folder name to whatever exists under `~/.jdks`. Building from
   inside Android Studio does **not** need this — the IDE manages its own JDK.)

## Every time you change the web app

```bash
npm run cap:sync      # build web + copy assets into android/
```

Then in Android Studio press **Run** (device or emulator).

`npm run android` also opens Android Studio — but **don't run it while Studio is
already open**, the two instances collide. Use `npm run cap:sync` for that case.

## Producing an APK

From the CLI (needs `JAVA_HOME`, see setup step 3):

```bash
npm run apk           # build web + sync + assembleDebug
```

Or in Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.

Either way the debug APK lands at
`android/app/build/outputs/apk/debug/app-debug.apk` (~4.6 MB). Install it on a
USB-connected phone with `npm run apk:install` (runs `adb install -r`), or copy
the file to the phone and tap it (allow "install unknown apps" for the app that
opens it).

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
