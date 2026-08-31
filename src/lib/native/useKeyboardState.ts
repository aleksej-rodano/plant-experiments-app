import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

export interface KeyboardState {
  /** True while the Android soft keyboard is on screen. Always false on web. */
  open: boolean
  /**
   * Pixels of the app window the keyboard covers that Android did *not* reclaim
   * by resizing the window — i.e. the amount the layout has to shrink itself by.
   * 0 whenever `adjustResize` did its job, which is the normal case.
   */
  inset: number
}

const CLOSED: KeyboardState = { open: false, inset: 0 }

/**
 * Tracks the Android soft keyboard.
 *
 * Android picks one of two behaviours when the IME opens: `adjustResize` shrinks
 * the app window (so a `height: 100%` layout shrinks with it), or `adjustPan`
 * slides the whole window up and leaves the web view at full screen height. The
 * manifest asks for `adjustResize`, and that is what this device does — but the
 * request is only a request: Android 15+ edge-to-edge and some OEM shells still
 * pan. Under pan the layout stays as tall as the phone while only its top half
 * is visible, and the unused space inside <main> reads as a dead band above the
 * keyboard.
 *
 * So rather than trust either mode, measure: if the window really shrank there
 * is nothing to do, and if it didn't we shrink the layout ourselves by the
 * keyboard height the plugin reports.
 *
 * Note that `@capacitor/keyboard`'s `resize` config option does nothing here —
 * on Android the plugin never calls `setSoftInputMode` and never reads that key
 * (`setResizeMode` is `unimplemented()`); it is an iOS-only setting. The
 * manifest's `android:windowSoftInputMode` is the only thing that decides.
 */
export function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(CLOSED)

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return

    // Window height with no keyboard up. Sampled on every open rather than once
    // at mount so rotation or a system-bar change can't leave it stale.
    let baseHeight = window.innerHeight
    let cleanup: (() => void) | undefined

    void import('@capacitor/keyboard').then(({ Keyboard }) => {
      // willShow fires before the window has been laid out again, so it is only
      // good for hiding the bottom nav promptly — not for measuring.
      const willShow = Keyboard.addListener('keyboardWillShow', () => {
        baseHeight = window.innerHeight
        setState((s) => (s.open ? s : { open: true, inset: 0 }))
      })

      // didShow fires once the IME animation has finished, by which point a
      // resize (if we got one) is reflected in window.innerHeight.
      const didShow = Keyboard.addListener('keyboardDidShow', (info) => {
        const shrankBy = baseHeight - window.innerHeight
        // Treat "gave back most of the keyboard's height" as a resize; the
        // halfway mark tolerates the few px of rounding between dp and CSS px.
        const resized = shrankBy > info.keyboardHeight / 2
        setState({ open: true, inset: resized ? 0 : Math.round(info.keyboardHeight) })
      })

      const willHide = Keyboard.addListener('keyboardWillHide', () => setState(CLOSED))

      cleanup = () => {
        void willShow.then((h) => h.remove())
        void didShow.then((h) => h.remove())
        void willHide.then((h) => h.remove())
      }
    })

    return () => cleanup?.()
  }, [])

  return state
}
