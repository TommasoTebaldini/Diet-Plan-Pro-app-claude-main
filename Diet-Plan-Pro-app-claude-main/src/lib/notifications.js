// ─── Notification preferences ─────────────────────────────────────────────────
export const PREFS_KEY = 'nutriplan_notif_prefs'

export const DEFAULT_PREFS = {
  // event-based (Supabase realtime)
  newMessage: true,
  newDocument: true,
  dietUpdate: true,
  // scheduled
  mealReminder: false,
  mealTimes: ['08:00', '13:00', '20:00'],
  waterReminder: false,
  waterIntervalHours: 2,
  weighReminder: false,
  weighDay: 1,      // 1 = Monday
  weighTime: '08:00',
  appointmentReminder: false,
  appointmentDate: '',
  appointmentTime: '',
}

export function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

// ─── Permission ────────────────────────────────────────────────────────────────
export function getPermissionStatus() {
  if (!('Notification' in window)) return 'not-supported'
  return Notification.permission
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'not-supported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

// ─── Show a notification ───────────────────────────────────────────────────────
export function showNotification(title, body, tag = 'nutriplan') {
  if (getPermissionStatus() !== 'granted') return
  const opts = {
    body,
    tag,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, opts))
      .catch(() => new Notification(title, opts))
  } else {
    new Notification(title, opts)
  }
}

// ─── Scheduling helpers ────────────────────────────────────────────────────────

/** Returns milliseconds until the next occurrence of HH:MM (today or tomorrow). */
function msUntilTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now)
  target.setHours(h, m, 0, 0)
  if (target <= now) target.setDate(target.getDate() + 1)
  return target - now
}

/**
 * Returns milliseconds until the next occurrence of dayOfWeek + timeStr.
 * dayOfWeek: 0=Sunday … 6=Saturday
 */
function msUntilNextWeekday(dayOfWeek, timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now)
  target.setHours(h, m, 0, 0)
  let daysUntil = (dayOfWeek - now.getDay() + 7) % 7
  if (daysUntil === 0 && target <= now) daysUntil = 7
  target.setDate(target.getDate() + daysUntil)
  return target - now
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
const _timers = []

function _clearAll() {
  _timers.forEach(id => clearTimeout(id))
  _timers.length = 0
}

/** Schedule fn() at HH:MM every day, repeating. */
function _scheduleDaily(fn, timeStr) {
  const tick = () => {
    fn()
    const id = setTimeout(tick, msUntilTime(timeStr))
    _timers.push(id)
  }
  const id = setTimeout(tick, msUntilTime(timeStr))
  _timers.push(id)
}

/** Schedule fn() every `intervalMs` starting now+interval. */
function _scheduleRepeating(fn, intervalMs) {
  const tick = () => {
    fn()
    const id = setTimeout(tick, intervalMs)
    _timers.push(id)
  }
  const id = setTimeout(tick, intervalMs)
  _timers.push(id)
}

/** Schedule fn() on the given weekday+time, then repeat weekly. */
function _scheduleWeekly(fn, dayOfWeek, timeStr) {
  const tick = () => {
    fn()
    const id = setTimeout(tick, 7 * 24 * 60 * 60 * 1000)
    _timers.push(id)
  }
  const id = setTimeout(tick, msUntilNextWeekday(dayOfWeek, timeStr))
  _timers.push(id)
}

// ─── Public init ──────────────────────────────────────────────────────────────
/**
 * Initialise (or reinitialise) all scheduled local notifications.
 * Call on app start and whenever prefs change.
 */
export function initScheduledNotifications(prefs) {
  _clearAll()
  if (getPermissionStatus() !== 'granted') return

  const p = { ...DEFAULT_PREFS, ...prefs }

  // Meal reminders
  if (p.mealReminder && Array.isArray(p.mealTimes)) {
    p.mealTimes.forEach((time, i) => {
      _scheduleDaily(
        () => showNotification('🍽️ Ora di mangiare!', 'Ricordati di registrare il tuo pasto', `meal-${i}`),
        time,
      )
    })
  }

  // Water reminders
  if (p.waterReminder && p.waterIntervalHours > 0) {
    const ms = p.waterIntervalHours * 60 * 60 * 1000
    _scheduleRepeating(
      () => showNotification('💧 Ricordati di bere!', "Bevi un bicchiere d'acqua per mantenerti idratato", 'water'),
      ms,
    )
  }

  // Weigh-in reminder
  if (p.weighReminder) {
    _scheduleWeekly(
      () => showNotification('⚖️ Giorno della bilancia!', 'Ricordati di pesarti e registrare il peso', 'weigh'),
      Number(p.weighDay),
      p.weighTime,
    )
  }

  // Appointment reminder (1 h before)
  if (p.appointmentReminder && p.appointmentDate && p.appointmentTime) {
    const appt = new Date(`${p.appointmentDate}T${p.appointmentTime}`)
    const delay = appt - Date.now() - 60 * 60 * 1000 // 1 hour before
    if (delay > 0) {
      const id = setTimeout(
        () => showNotification('📅 Appuntamento tra 1 ora!', `Hai una visita dal dietista alle ${p.appointmentTime}`, 'appointment'),
        delay,
      )
      _timers.push(id)
    }
  }
}
