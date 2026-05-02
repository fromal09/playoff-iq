'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const TABS = [
  { href:'/database',  label:'Games',      icon:'📋' },
  { href:'/aggregate', label:'Careers',    icon:'👤' },
  { href:'/goat',      label:'GOAT Index', icon:'🏆' },
  { href:'/admin',     label:'Admin',      icon:'⚙️' },
]

export default function Nav() {
  const path = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      {/* ── Desktop nav ── */}
      <nav style={{
        background:'var(--blue)',display:'flex',alignItems:'center',height:54,
        padding:'0 28px',position:'sticky',top:0,zIndex:50,
        boxShadow:'0 2px 12px rgba(26,22,18,.22)',borderBottom:'1px solid rgba(255,255,255,0.08)',
      }} className="desktop-only">
        <Link href="/database" style={{display:'flex',alignItems:'baseline',gap:8,marginRight:36,flexShrink:0,textDecoration:'none'}}>
          <span style={{fontFamily:'var(--font-head)',fontSize:22,fontWeight:700,color:'#fff',letterSpacing:'-0.01em',lineHeight:1}}>Playoff IQ</span>
          <span style={{fontFamily:'var(--font-body)',fontSize:11,fontWeight:400,color:'rgba(255,255,255,0.45)',letterSpacing:'0.12em',textTransform:'uppercase',paddingBottom:1}}>
            NBA Playoffs · 1947–present
          </span>
        </Link>
        <div style={{display:'flex',gap:0,height:'100%',marginRight:'auto'}}>
          {TABS.map(t=>{
            const active=path.startsWith(t.href)
            return(
              <Link key={t.href} href={t.href} style={{display:'flex',alignItems:'center',padding:'0 15px',fontSize:13,fontWeight:active?600:400,color:active?'#fff':'rgba(255,255,255,0.6)',borderBottom:active?'2px solid rgba(255,255,255,0.9)':'2px solid transparent',transition:'all .15s',height:'100%',letterSpacing:'0.01em'}}>
                {t.label}
              </Link>
            )
          })}
        </div>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.06em',textTransform:'uppercase'}}>
          Every playoff game. Every player. Every era.
        </span>
      </nav>

      {/* ── Mobile top bar ── */}
      <nav style={{
        background:'var(--blue)',display:'none',alignItems:'center',height:50,
        padding:'0 16px',position:'sticky',top:0,zIndex:50,
        boxShadow:'0 2px 8px rgba(26,22,18,.20)',
      }} className="mobile-only" role="navigation">
        <Link href="/database" style={{fontFamily:'var(--font-head)',fontSize:20,fontWeight:700,color:'#fff',letterSpacing:'-0.01em',textDecoration:'none',flex:1}}>
          Playoff IQ
        </Link>
        <button
          onClick={()=>setMenuOpen(o=>!o)}
          style={{background:'none',border:'none',color:'#fff',fontSize:22,cursor:'pointer',padding:'4px 8px',lineHeight:1}}
          aria-label="Menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen&&(
        <div style={{position:'fixed',top:50,left:0,right:0,zIndex:49,background:'var(--blue)',borderBottom:'1px solid rgba(255,255,255,0.12)',boxShadow:'0 4px 16px rgba(26,22,18,.25)'}}>
          {TABS.map(t=>{
            const active=path.startsWith(t.href)
            return(
              <Link key={t.href} href={t.href} onClick={()=>setMenuOpen(false)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',fontSize:15,fontWeight:active?600:400,color:active?'#fff':'rgba(255,255,255,0.75)',borderBottom:'1px solid rgba(255,255,255,0.08)',textDecoration:'none',background:active?'rgba(255,255,255,0.08)':'none'}}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {active&&<span style={{marginLeft:'auto',fontSize:12,color:'rgba(255,255,255,0.5)'}}>●</span>}
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Mobile bottom tab bar ── */}
      <div style={{
        display:'none',position:'fixed',bottom:0,left:0,right:0,zIndex:50,
        background:'var(--surface)',borderTop:'1px solid var(--border)',
        boxShadow:'0 -2px 12px rgba(26,22,18,.10)',
        paddingBottom:'env(safe-area-inset-bottom)',
      }} className="mobile-only">
        {TABS.filter(t=>t.href!=='/admin').map(t=>{
          const active=path.startsWith(t.href)
          return(
            <Link key={t.href} href={t.href} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 4px 4px',fontSize:10,fontWeight:active?700:400,color:active?'var(--blue)':'var(--text3)',textDecoration:'none',gap:2,textTransform:'uppercase',letterSpacing:'0.05em'}}>
              <span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>
              {t.label}
            </Link>
          )
        })}
      </div>
      {/* Spacer so content doesn't hide behind bottom bar on mobile */}
      <div style={{height:0}} className="mobile-only" id="bottom-bar-spacer"/>
    </>
  )
}
