import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

/**
 * True while the Android soft keyboard is on screen; always false on web.
 * Used to drop the bottom nav so it doesn't eat height out of the shrunken
 * window while typing.
 *
 * The layout itself needs no help: `android:windowSoftInputMode="adjustResize"`
 * on the activity makes Android shrink the app window when the IME opens, so
 * the `height: 100%` layout shrinks with it and <main> scrolls the focused
 * field into view.
 *
 * Note that `@capacitor/keyboard`'s `resize` config option does nothing here —
 * on Android the plugin never calls setSoftInputMode and never reads that key
 * (`setResizeMode` is `unimplemented()`); it is iOS-only. Without the manifest
 * attribute the window defaults to adjustPan, the web view keeps its full
 * screen height, and the unused space inside <main> shows up as a dead band
 * above the keyboard. `adb shell dumpsys window windows | grep sim=` reports
 * which mode the window is really in.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return

    let cleanup: (() => void) | undefined
    void import('@capacitor/keyboard').then(({ Keyboard }) => {
      const show = Keyboard.addListener('keyboardWillShow', () => setOpen(true))
      const hide = Keyboard.addListener('keyboardWillHide', () => setOpen(false))
      cleanup = () => {
        void show.then((h) => h.remove())
        void hide.then((h) => h.remove())
      }
    })

    return () => cleanup?.()
  }, [])

  return open
}
