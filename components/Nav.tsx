'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href:'/database',  label:'Games'      },
  { href:'/aggregate', label:'Careers'    },
  { href:'/goat',      label:'GOAT Index' },
  { href:'/admin',     label:'Admin'      },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      background: 'var(--blue)',
      display: 'flex',
      alignItems: 'center',
      height: 54,
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 2px 12px rgba(26,22,18,.22)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Wordmark */}
      <Link href="/database" style={{ display:'flex', alignItems:'baseline', gap:8, marginRight:36, flexShrink:0, textDecoration:'none' }}>
        <span style={{
          fontFamily: 'var(--font-head)',
          fontSize: 22,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          Playoff IQ
        </span>
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          paddingBottom: 1,
        }}>
          NBA Playoffs · 1947–present
        </span>
      </Link>

      {/* Nav tabs */}
      <div style={{ display:'flex', gap:0, height:'100%', marginRight:'auto' }}>
        {TABS.map(t => {
          const active = path.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 15px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
              borderBottom: active ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
              transition: 'all .15s',
              height: '100%',
              letterSpacing: '0.01em',
            }}>
              {t.label}
            </Link>
          )
        })}
      </div>

      {/* Right side tagline */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        Every playoff game. Every player. Every era.
      </span>
    </nav>
  )
}
