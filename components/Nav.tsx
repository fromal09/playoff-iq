'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const TABS = [
  { href:'/database',  label:'Games'      },
  { href:'/aggregate', label:'Careers'    },
  { href:'/playoffs',  label:'2026 Playoffs'},
  { href:'/goat',      label:'GOAT Index' },
  { href:'/crown',     label:'The Crown'  },
  { href:'/admin',     label:'Admin'      },
]

const MOBILE_TABS = [
  { href:'/database',  label:'Games',   icon:'📋' },
  { href:'/aggregate', label:'Careers', icon:'👤' },
  { href:'/goat',      label:'GOAT',    icon:'🏆' },
  { href:'/crown',     label:'Crown',   icon:'👑' },
]

export default function Nav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <style>{`
        .piq-desk { display:flex; }
        .piq-mob  { display:none; }
        .piq-bar  { display:none; }
        @media (max-width:768px){
          .piq-desk { display:none !important; }
          .piq-mob  { display:flex !important; }
          .piq-bar  { display:flex !important; }
        }
      `}</style>

      {/* ── Desktop ── */}
      <nav className="piq-desk" style={{
        background:'var(--blue)', height:72, alignItems:'center',
        padding:'0 24px', position:'sticky', top:0, zIndex:50,
        boxShadow:'0 2px 14px rgba(26,22,18,.22)',
      }}>
        <Link href="/database" style={{display:'flex',alignItems:'center',gap:12,textDecoration:'none',flexShrink:0,marginRight:32}}>
          <img src="/logo.jpg" alt="Playoff IQ" width={54} height={54}
            style={{borderRadius:'50%',display:'block',objectFit:'cover',border:'2px solid rgba(196,168,74,0.5)'}}/>
          <div>
            <div style={{fontFamily:'var(--font-head)',fontSize:21,fontWeight:700,color:'#fff',letterSpacing:'-0.01em',lineHeight:1}}>
              Playoff IQ
            </div>
            <div style={{fontFamily:'var(--font-body)',fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.13em',textTransform:'uppercase',marginTop:3}}>
              NBA · 1947–Present
            </div>
          </div>
        </Link>

        <div style={{display:'flex',flex:1,height:'100%',alignItems:'stretch',justifyContent:'flex-end'}}>
          {TABS.map(t => {
            const active = path.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} style={{
                display:'flex', alignItems:'center', padding:'0 20px',
                fontSize:13.5, fontWeight:active?600:400,
                color:active?'#fff':'rgba(255,255,255,0.65)',
                borderBottom:active?'2px solid rgba(255,255,255,0.9)':'2px solid transparent',
                whiteSpace:'nowrap', letterSpacing:'0.01em',
                transition:'color .15s',
              }}>
                {t.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Mobile top bar ── */}
      <nav className="piq-mob" style={{
        background:'var(--blue)', height:52, alignItems:'center',
        padding:'0 14px', position:'sticky', top:0, zIndex:50,
        boxShadow:'0 2px 8px rgba(26,22,18,.2)',
      }}>
        <Link href="/database" style={{display:'flex',alignItems:'center',gap:9,textDecoration:'none',flex:1}}>
          <img src="/logo.jpg" alt="Playoff IQ" width={36} height={36}
            style={{borderRadius:'50%',display:'block',objectFit:'cover',border:'1.5px solid rgba(196,168,74,0.5)'}}/>
          <span style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700,color:'#fff',letterSpacing:'-0.01em'}}>
            Playoff IQ
          </span>
        </Link>
        <button onClick={()=>setOpen(o=>!o)}
          style={{background:'none',border:'none',color:'#fff',fontSize:20,cursor:'pointer',padding:'6px 8px',lineHeight:1}}>
          {open?'✕':'☰'}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div style={{position:'fixed',top:52,left:0,right:0,zIndex:49,background:'var(--blue)',
          borderBottom:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 4px 12px rgba(26,22,18,.25)'}}>
          {TABS.map(t => {
            const active = path.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} onClick={()=>setOpen(false)} style={{
                display:'flex', alignItems:'center', padding:'14px 18px',
                fontSize:14, fontWeight:active?600:400,
                color:active?'#fff':'rgba(255,255,255,0.75)',
                borderBottom:'1px solid rgba(255,255,255,0.07)',
                textDecoration:'none', background:active?'rgba(255,255,255,0.08)':'none',
              }}>
                {t.label}
                {active && <span style={{marginLeft:'auto',fontSize:10,color:'rgba(255,255,255,0.4)'}}>●</span>}
              </Link>
            )
          })}
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <div className="piq-bar" style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:'var(--surface)', borderTop:'1px solid var(--border)',
        boxShadow:'0 -2px 10px rgba(26,22,18,.08)',
        paddingBottom:'env(safe-area-inset-bottom)',
      }}>
        {MOBILE_TABS.map(t => {
          const active = path.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              padding:'7px 4px 3px', fontSize:9.5, fontWeight:active?700:400,
              color:active?'var(--blue)':'var(--text3)',
              textDecoration:'none', gap:2,
              textTransform:'uppercase', letterSpacing:'0.04em',
            }}>
              <span style={{fontSize:17,lineHeight:1}}>{t.icon}</span>
              {t.label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
