/**
 * A tiny stack of "consume the next back press" handlers. Full-screen overlays
 * (e.g. the photo viewer) register one while they're open so the Android
 * hardware back button closes the overlay instead of navigating the page away.
 */
type Handler = () => void

const handlers: Handler[] = []

/** Register a handler; returns an unregister function. */
export function pushBackInterceptor(fn: Handler): () => void {
  handlers.push(fn)
  return () => {
    const i = handlers.lastIndexOf(fn)
    if (i !== -1) handlers.splice(i, 1)
  }
}

/**
 * Run the most-recently-registered handler, if any.
 * @returns true when a handler consumed the back press.
 */
export function consumeBack(): boolean {
  const fn = handlers[handlers.length - 1]
  if (!fn) return false
  fn()
  return true
}
