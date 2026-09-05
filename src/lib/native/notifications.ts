import { Capacitor } from '@capacitor/core'
import type { LocalNotificationSchema } from '@capacitor/local-notifications'
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabase'
import { careStatus, type CareSchedule } from '../utils/care'

// We schedule a notification per day for the next three weeks; each one lists
// every folder / experiment chore that is due or overdue on that day. Because
// the whole set is rebuilt every time the app opens (and after any care edit),
// an untouched overdue task keeps reappearing each morning until it's marked
// done. IDs live in a fixed band we can safely clear and rewrite.
const FIRE_HOUR = 11
const DAYS_AHEAD = 21
const ID_BASE = 47_000

let resumeListenerBound = false

function isAndroid() {
  return Capacitor.getPlatform() === 'android'
}

interface Task {
  name: string
  schedule: CareSchedule
}

async function collectTasks(): Promise<Task[]> {
  const cols = 'title, care_task_label, care_interval_days, care_last_done_on'
  const [folders, experiments] = await Promise.all([
    supabase.from('folders').select(cols).is('deleted_at', null),
    supabase.from('experiments').select(cols).is('deleted_at', null),
  ])
  const rows = [...(folders.data ?? []), ...(experiments.data ?? [])]
  return rows
    .filter((r) => (r.care_interval_days ?? 0) > 0)
    .map((r) => ({ name: r.title, schedule: r as CareSchedule }))
}

function atHour(offsetDays: number): Date {
  const d = new Date()
  d.setHours(FIRE_HOUR, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d
}

/**
 * Rebuild the local care reminders from the user's current schedules. A no-op on
 * anything but the Android app; safe to call as often as you like (fire and
 * forget — failures are swallowed so it never breaks a save).
 */
export async function syncCareNotifications(): Promise<void> {
  if (!isAndroid()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') {
      const asked = await LocalNotifications.requestPermissions()
      if (asked.display !== 'granted') return
    }

    // Clear whatever we scheduled last time so stale days don't linger.
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter(
      (n) => typeof n.id === 'number' && n.id >= ID_BASE && n.id < ID_BASE + DAYS_AHEAD,
    )
    if (ours.length) await LocalNotifications.cancel({ notifications: ours })

    const tasks = await collectTasks()
    if (tasks.length === 0) return

    const notifications: LocalNotificationSchema[] = []
    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const fireAt = atHour(offset)
      if (fireAt.getTime() <= Date.now()) continue // today, already past 11:00

      const dueLines = tasks
        .map((t) => ({ t, st: careStatus(t.schedule) }))
        .filter(({ st }) => st != null && st.daysUntilDue <= offset)
        .map(
          ({ t }) =>
            `${t.schedule.care_task_label?.trim() || 'Care'}: ${t.name}`,
        )
      if (dueLines.length === 0) continue

      notifications.push({
        id: ID_BASE + offset,
        title:
          dueLines.length === 1
            ? 'Plant care due today'
            : `${dueLines.length} plant care tasks due`,
        body: dueLines.slice(0, 10).join('\n'),
        schedule: { at: fireAt, allowWhileIdle: true },
      })
    }

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch {
    // Plugin missing, permission race, offline — not worth surfacing.
  }
}

/**
 * Keeps the Android care reminders in sync: once when a signed-in session
 * appears, and again every time the app is brought back to the foreground.
 */
export function useCareNotificationsSync(): void {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id || !isAndroid()) return
    void syncCareNotifications()
  }, [user?.id])

  useEffect(() => {
    if (!isAndroid() || resumeListenerBound) return
    resumeListenerBound = true
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        await App.addListener('resume', () => {
          void syncCareNotifications()
        })
      } catch {
        resumeListenerBound = false
      }
    })()
  }, [])
}
