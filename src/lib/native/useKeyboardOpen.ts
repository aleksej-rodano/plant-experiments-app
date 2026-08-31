import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

/**
 * True while the Android soft keyboard is on screen. Used to hide the fixed
 * bottom nav so it doesn't float up over the form (and so `viewport-fit=cover`
 * safe-area insets, which balloon while the keyboard is up, stop mattering).
 * Always false on web.
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
