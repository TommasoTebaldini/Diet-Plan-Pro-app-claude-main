import { createContext, useContext, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { loadPrefs, initScheduledNotifications, showNotification } from '../lib/notifications'

const NotificationContext = createContext({})

export function NotificationProvider({ children, user }) {
  const channelsRef = useRef([])

  // (Re)initialise whenever user changes or on first mount
  useEffect(() => {
    if (!user) return

    // Scheduled local notifications
    const prefs = loadPrefs()
    initScheduledNotifications(prefs)

    // ── Supabase Realtime subscriptions ───────────────────────────────────────
    const p = loadPrefs()

    // New chat message from dietitian
    const chatChannel = supabase
      .channel(`notif-chat-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `patient_id=eq.${user.id}` },
        payload => {
          if (payload.new?.sender_role === 'dietitian' && p.newMessage) {
            showNotification('💬 Nuovo messaggio dal dietista', payload.new.content?.slice(0, 80) || '', 'chat-msg')
          }
        },
      )
      .subscribe()

    // New document shared
    const docChannel = supabase
      .channel(`notif-docs-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'patient_documents', filter: `patient_id=eq.${user.id}` },
        payload => {
          if (payload.new?.visible && p.newDocument) {
            showNotification('📄 Nuovo documento condiviso', payload.new.title || 'Il tuo dietista ha condiviso un documento', 'doc-new')
          }
        },
      )
      .subscribe()

    // Diet plan update (INSERT or UPDATE on diet_plans)
    const dietChannel = supabase
      .channel(`notif-diet-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'diet_plans', filter: `patient_id=eq.${user.id}` },
        () => {
          if (p.dietUpdate) {
            showNotification('🥗 Piano alimentare aggiornato', 'Il tuo dietista ha aggiornato la tua dieta', 'diet-update')
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'diet_plans', filter: `patient_id=eq.${user.id}` },
        () => {
          if (p.dietUpdate) {
            showNotification('🥗 Piano alimentare aggiornato', 'Il tuo dietista ha modificato la tua dieta', 'diet-update')
          }
        },
      )
      .subscribe()

    channelsRef.current = [chatChannel, docChannel, dietChannel]

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []
    }
  }, [user?.id])

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
