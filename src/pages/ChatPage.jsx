import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Send, CheckCheck, Check, MessageCircle,
  ImagePlus, Mic, MicOff, X, Play, Pause, Bell, BellOff
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(msgs) {
  const groups = {}
  msgs.forEach(m => {
    const day = new Date(m.created_at).toDateString()
    if (!groups[day]) groups[day] = []
    groups[day].push(m)
  })
  return groups
}

function dayLabel(dateStr) {
  const d = new Date(dateStr); const now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Oggi'
  if (d.toDateString() === y.toDateString()) return 'Ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function lastSeenLabel(ts) {
  if (!ts) return null
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 5 * 60 * 1000) return null // is online
  if (diff < 60 * 60 * 1000) return `visto ${Math.floor(diff / 60000)} min fa`
  if (diff < 24 * 60 * 60 * 1000)
    return 'visto ' + new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return 'visto ' + new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// ── AudioPlayer ─────────────────────────────────────────────────────────────

function AudioPlayer({ src, isMe }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <audio
        ref={audioRef} src={src} preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onLoadedMetadata={e => setDuration(e.target.duration || 0)}
        onTimeUpdate={e => setProgress(e.target.currentTime / (e.target.duration || 1))}
      />
      <button
        onClick={toggle}
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isMe ? 'rgba(255,255,255,0.25)' : 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {playing
          ? <Pause size={14} color={isMe ? 'white' : 'var(--green-main)'} />
          : <Play size={14} color={isMe ? 'white' : 'var(--green-main)'} style={{ marginLeft: 1 }} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 3, borderRadius: 2, background: isMe ? 'rgba(255,255,255,0.3)' : 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: isMe ? 'white' : 'var(--green-main)', borderRadius: 2, transition: 'width 0.1s' }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2, display: 'block' }}>
          {duration > 0 ? formatDuration(duration) : '–'}
        </span>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth()

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [dietitian, setDietitian] = useState(null)
  const [dietitianId, setDietitianId] = useState(null)
  const [notLinked, setNotLinked] = useState(false)

  // Online status
  const [dietitianLastSeen, setDietitianLastSeen] = useState(null)

  // Voice recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)

  // Notifications
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const presenceIntervalRef = useRef(null)
  const dietitianIdRef = useRef(null)

  // ── Notification permission ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifPermission(p))
    }
  }, [])

  // ── Load data + realtime ────────────────────────────────────────────────
  useEffect(() => {
    let channel
    loadData().then(dId => {
      if (!dId) return
      // Realtime: new chat messages
      channel = supabase.channel(`chat-patient-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chat_messages',
          filter: `patient_id=eq.${user.id}`
        }, payload => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          if (payload.new.sender_role === 'dietitian') {
            markAsRead([payload.new.id])
            showPushNotification(payload.new)
          }
        })
        // Realtime: read receipts updated (dietitian read our messages)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'chat_messages',
          filter: `patient_id=eq.${user.id}`
        }, payload => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m))
        })
        // Realtime: dietitian online status
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'profiles',
          filter: `id=eq.${dId}`
        }, payload => {
          setDietitianLastSeen(payload.new.last_seen_at)
        })
        .subscribe()
    })

    // Update patient's own last_seen_at every 60s
    updateLastSeen()
    presenceIntervalRef.current = setInterval(updateLastSeen, 60_000)

    return () => {
      if (channel) supabase.removeChannel(channel)
      clearInterval(presenceIntervalRef.current)
      stopRecording(true)
    }
  }, [user.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function updateLastSeen() {
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
  }

  async function loadData() {
    const { data: link } = await supabase
      .from('patient_dietitian')
      .select('dietitian_id')
      .eq('patient_id', user.id)
      .maybeSingle()

    if (!link) {
      setNotLinked(true)
      setLoading(false)
      return null
    }

    const dId = link.dietitian_id
    setDietitianId(dId)
    dietitianIdRef.current = dId

    const { data: dProfile } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name, last_seen_at')
      .eq('id', dId)
      .maybeSingle()

    setDietitian(dProfile || { full_name: 'Il tuo dietista' })
    setDietitianLastSeen(dProfile?.last_seen_at || null)

    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    const unread = (msgs || []).filter(m => m.sender_role === 'dietitian' && !m.read_at)
    if (unread.length) markAsRead(unread.map(m => m.id))

    setLoading(false)
    return dId
  }

  async function markAsRead(ids) {
    if (!ids.length) return
    await supabase.from('chat_messages').update({ read_at: new Date().toISOString() }).in('id', ids)
  }

  function showPushNotification(msg) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return
    const dName = dietitian?.full_name ||
      `${dietitian?.first_name || ''} ${dietitian?.last_name || ''}`.trim() || 'Dietista'
    const body = msg.message_type === 'image' ? '📷 Foto' :
      msg.message_type === 'audio' ? '🎤 Messaggio vocale' : msg.content
    new Notification(`Nuovo messaggio da ${dName}`, { body, icon: '/icons/icon-192x192.png' })
  }

  // ── Send text message ───────────────────────────────────────────────────
  async function sendMessage(e) {
    e?.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText('')
    const optimistic = {
      id: `opt_${Date.now()}`, patient_id: user.id,
      sender_role: 'patient', sender_id: user.id,
      content, message_type: 'text', created_at: new Date().toISOString(), read_at: null
    }
    setMessages(prev => [...prev, optimistic])
    const { data, error } = await supabase.from('chat_messages').insert({
      patient_id: user.id, sender_role: 'patient',
      sender_id: user.id, content, message_type: 'text'
    }).select().single()
    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    } else if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(content)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  // ── Upload helper ───────────────────────────────────────────────────────
  async function uploadToStorage(file, folder) {
    const ext = file.name ? file.name.split('.').pop() : 'bin'
    const path = `${user.id}/${folder}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-media').upload(path, file)
    if (error) throw error
    const { data: signed } = await supabase.storage
      .from('chat-media')
      .createSignedUrl(path, 315_360_000) // ~10 years
    return signed.signedUrl
  }

  // ── Photo upload ────────────────────────────────────────────────────────
  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setSending(true)
    const optimistic = {
      id: `opt_${Date.now()}`, patient_id: user.id,
      sender_role: 'patient', sender_id: user.id,
      content: '', message_type: 'image', file_url: URL.createObjectURL(file),
      file_name: file.name, created_at: new Date().toISOString(), read_at: null
    }
    setMessages(prev => [...prev, optimistic])
    try {
      const fileUrl = await uploadToStorage(file, 'img')
      const { data, error } = await supabase.from('chat_messages').insert({
        patient_id: user.id, sender_role: 'patient', sender_id: user.id,
        content: '', message_type: 'image', file_url: fileUrl, file_name: file.name
      }).select().single()
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
      } else if (error) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    }
    setSending(false)
  }

  // ── Voice recording ─────────────────────────────────────────────────────
  async function startRecording() {
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const dur = recordingDuration
        setIsRecording(false)
        setRecordingDuration(0)
        await sendAudio(blob, dur, mimeType)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000)
    } catch {
      alert('Impossibile accedere al microfono.')
    }
  }

  function stopRecording(cancel = false) {
    clearInterval(recordingTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.ondataavailable = null
        mediaRecorderRef.current.onstop = () => {
          mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
        }
      }
      mediaRecorderRef.current.stop()
    }
    if (cancel) {
      setIsRecording(false)
      setRecordingDuration(0)
    }
  }

  async function sendAudio(blob, dur, mimeType) {
    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })
    setSending(true)
    const optimistic = {
      id: `opt_${Date.now()}`, patient_id: user.id,
      sender_role: 'patient', sender_id: user.id,
      content: '', message_type: 'audio', file_url: URL.createObjectURL(blob),
      duration_seconds: dur, created_at: new Date().toISOString(), read_at: null
    }
    setMessages(prev => [...prev, optimistic])
    try {
      const fileUrl = await uploadToStorage(file, 'audio')
      const { data, error } = await supabase.from('chat_messages').insert({
        patient_id: user.id, sender_role: 'patient', sender_id: user.id,
        content: '', message_type: 'audio', file_url: fileUrl, duration_seconds: dur
      }).select().single()
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
      } else if (error) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    }
    setSending(false)
  }

  // ── Notification toggle ─────────────────────────────────────────────────
  async function requestNotifications() {
    if (typeof Notification === 'undefined') return
    const p = await Notification.requestPermission()
    setNotifPermission(p)
  }

  // ── Derived values ──────────────────────────────────────────────────────
  const dietitianName = dietitian?.full_name ||
    `${dietitian?.first_name || ''} ${dietitian?.last_name || ''}`.trim() || 'Il tuo dietista'

  const isOnline = dietitianLastSeen
    ? (Date.now() - new Date(dietitianLastSeen).getTime()) < 5 * 60 * 1000
    : false

  const seenLabel = isOnline ? 'Online' : lastSeenLabel(dietitianLastSeen)

  const canSendText = text.trim().length > 0 && !sending && !isRecording

  // ── Not linked ──────────────────────────────────────────────────────────
  if (!loading && notLinked) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface-2)' }}>
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 22, color: 'white', fontWeight: 300 }}>Chat</h1>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <MessageCircle size={32} color="var(--green-main)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 300, marginBottom: 10 }}>
          Nessun dietista collegato
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>
          Per usare la chat, il tuo dietista deve collegarti al suo profilo dalla piattaforma professionale.
        </p>
        <div style={{ marginTop: 24, background: 'var(--green-pale)', borderRadius: 14, padding: '16px 20px', maxWidth: 320 }}>
          <p style={{ fontSize: 13, color: 'var(--green-dark)', lineHeight: 1.6 }}>
            💡 Chiedi al tuo dietista di cercare la tua email (<strong>{user.email}</strong>) nella sezione "Collega paziente" della sua app.
          </p>
        </div>
      </div>
      <div style={{ height: 'calc(72px + env(safe-area-inset-bottom))' }} />
    </div>
  )

  const groups = groupByDate(messages)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--surface-2)', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
      {/* Hidden file input for photos */}
      <input
        ref={fileInputRef} type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handlePhotoSelected}
      />

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, var(--green-dark), var(--green-main))', padding: 'calc(env(safe-area-inset-top) + 14px) 16px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {/* Avatar with online indicator */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', border: '2px solid rgba(255,255,255,0.3)' }}>
            {dietitianName[0]?.toUpperCase()}
          </div>
          {/* Online dot */}
          <span style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: isOnline ? '#4ade80' : '#94a3b8',
            border: '2px solid rgba(10,74,46,0.9)',
            transition: 'background 0.3s'
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>{dietitianName}</p>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11 }}>
            {seenLabel || 'Dietista'}
          </p>
        </div>
        {/* Notification bell */}
        {typeof Notification !== 'undefined' && (
          <button
            onClick={requestNotifications}
            title={notifPermission === 'granted' ? 'Notifiche attive' : 'Attiva notifiche'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', opacity: notifPermission === 'granted' ? 1 : 0.55 }}
          >
            {notifPermission === 'granted'
              ? <Bell size={18} color="white" />
              : <BellOff size={18} color="white" />}
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 0', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green-main)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Caricamento…</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Inizia la conversazione</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Scrivi un messaggio a {dietitianName}<br />per domande o aggiornamenti.</p>
          </div>
        ) : (
          Object.entries(groups).map(([day, msgs]) => (
            <div key={day}>
              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <span style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 11, padding: '3px 10px', borderRadius: 100 }}>{dayLabel(day)}</span>
              </div>
              {msgs.map((msg, i) => {
                const isMe = msg.sender_role === 'patient'
                const showAvatar = !isMe && (i === 0 || msgs[i - 1]?.sender_role !== msg.sender_role)
                const type = msg.message_type || 'text'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 5, alignItems: 'flex-end', gap: 6 }}>
                    {!isMe && (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--green-main)', flexShrink: 0, visibility: showAvatar ? 'visible' : 'hidden' }}>
                        {dietitianName[0]}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%', background: isMe ? 'linear-gradient(135deg, var(--green-main), var(--green-mid))' : 'white', color: isMe ? 'white' : 'var(--text-primary)', padding: type === 'image' ? '4px 4px 8px' : '9px 13px', borderRadius: isMe ? '16px 16px 3px 16px' : '16px 16px 16px 3px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: isMe ? 'none' : '1px solid var(--border-light)', overflow: 'hidden' }}>
                      {type === 'text' && (
                        <p style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
                      )}
                      {type === 'image' && msg.file_url && (
                        <div>
                          <img
                            src={msg.file_url} alt="Foto"
                            style={{ display: 'block', maxWidth: 220, maxHeight: 220, borderRadius: 12, objectFit: 'cover', cursor: 'pointer' }}
                            onClick={() => window.open(msg.file_url, '_blank')}
                          />
                        </div>
                      )}
                      {type === 'audio' && msg.file_url && (
                        <AudioPlayer src={msg.file_url} isMe={isMe} />
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 4, paddingRight: type === 'image' ? 6 : 0 }}>
                        <span style={{ fontSize: 10, opacity: 0.65 }}>{formatTime(msg.created_at)}</span>
                        {isMe && (msg.read_at
                          ? <CheckCheck size={11} color={isMe ? 'rgba(255,255,255,0.85)' : 'var(--green-main)'} />
                          : <Check size={11} style={{ opacity: 0.45 }} />)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Input bar */}
      <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom))', left: 0, right: 0, padding: '8px 10px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border-light)', zIndex: 50 }}>
        {isRecording ? (
          // ── Recording UI ──
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            <button
              onClick={() => stopRecording(true)}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={16} color="var(--red)" />
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--red)' }}>
                {formatDuration(recordingDuration)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Registrazione…</span>
            </div>
            <button
              onClick={() => stopRecording(false)}
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--green-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(21,122,74,0.35)' }}
            >
              <Send size={17} color="white" style={{ marginLeft: 2 }} />
            </button>
          </div>
        ) : (
          // ── Normal input ──
          <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
            {/* Photo button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: sending ? 'default' : 'pointer', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: sending ? 0.5 : 1 }}
            >
              <ImagePlus size={18} color="var(--text-muted)" />
            </button>

            {/* Text area */}
            <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 22, border: '1.5px solid var(--border)', padding: '9px 14px', display: 'flex', alignItems: 'center' }}>
              <textarea
                ref={inputRef} value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Scrivi un messaggio…" rows={1}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-b)', fontSize: 15, color: 'var(--text-primary)', resize: 'none', maxHeight: 100, lineHeight: 1.5 }}
              />
            </div>

            {/* Send / Mic button */}
            {canSendText ? (
              <button
                type="submit"
                style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'var(--green-main)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(26,127,90,0.3)' }}
              >
                <Send size={17} color="white" style={{ marginLeft: 2 }} />
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={startRecording}
                onTouchStart={e => { e.preventDefault(); startRecording() }}
                disabled={sending}
                style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: sending ? 'var(--border)' : 'var(--surface-3)', border: 'none', cursor: sending ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.5 : 1 }}
              >
                <Mic size={19} color="var(--text-muted)" />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
