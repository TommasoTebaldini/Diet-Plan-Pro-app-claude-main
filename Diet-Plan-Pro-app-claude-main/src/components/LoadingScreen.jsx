import { Leaf } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green-main) 100%)',
      gap: 20
    }}>
      <div style={{
        width: 72, height: 72,
        borderRadius: 24,
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.2)',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        <Leaf size={36} color="white" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`
          }} />
        ))}
      </div>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 300 }}>
        NutriPlan
      </p>
    </div>
  )
}
