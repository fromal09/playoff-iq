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
      {/* Desktop nav */}
      <nav style={{
        background:'var(--blue)', height:48, display:'flex', alignItems:'center',
        padding:'0 16px', position:'sticky', top:0, zIndex:50,
        boxShadow:'0 2px 10px rgba(26,22,18,.2)', flexWrap:'nowrap', minWidth:0,
      }} className="desktop-only">
        <Link href="/database" style={{
          fontFamily:'var(--font-head)', fontSize:19, fontWeight:700, color:'#fff',
          letterSpacing:'-0.01em', lineHeight:1, marginRight:20, flexShrink:0,
          textDecoration:'none', whiteSpace:'nowrap',
        }}>
          Playoff IQ
        </Link>
        <div style={{display:'flex',height:'100%',flexShrink:0,minWidth:0}}>
          {TABS.map(t=>{
            const active=path.startsWith(t.href)
            return(
              <Link key={t.href} href={t.href} style={{
                display:'flex', alignItems:'center', padding:'0 12px',
                fontSize:13, fontWeight:active?600:400,
                color:active?'#fff':'rgba(255,255,255,0.6)',
                borderBottom:active?'2px solid rgba(255,255,255,0.85)':'2px solid transparent',
                transition:'color .15s', whiteSpace:'nowrap',
              }}>
                {t.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Mobile top bar */}
      <nav style={{
        background:'var(--blue)',display:'none',alignItems:'center',height:48,
        padding:'0 14px',position:'sticky',top:0,zIndex:50,
        boxShadow:'0 2px 8px rgba(26,22,18,.2)',
      }} className="mobile-only">
        <Link href="/database" style={{fontFamily:'var(--font-head)',fontSize:19,fontWeight:700,color:'#fff',letterSpacing:'-0.01em',textDecoration:'none',flex:1}}>
          Playoff IQ
        </Link>
        <button onClick={()=>setMenuOpen(o=>!o)}
          style={{background:'none',border:'none',color:'#fff',fontSize:20,cursor:'pointer',padding:'6px 8px',lineHeight:1}}>
          {menuOpen?'✕':'☰'}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen&&(
        <div style={{position:'fixed',top:48,left:0,right:0,zIndex:49,background:'var(--blue)',borderBottom:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 4px 12px rgba(26,22,18,.25)'}}>
          {TABS.map(t=>{
            const active=path.startsWith(t.href)
            return(
              <Link key={t.href} href={t.href} onClick={()=>setMenuOpen(false)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'13px 18px',fontSize:14,fontWeight:active?600:400,color:active?'#fff':'rgba(255,255,255,0.75)',borderBottom:'1px solid rgba(255,255,255,0.07)',textDecoration:'none',background:active?'rgba(255,255,255,0.08)':'none'}}>
                <span>{t.icon}</span><span>{t.label}</span>
                {active&&<span style={{marginLeft:'auto',fontSize:11,color:'rgba(255,255,255,0.45)'}}>●</span>}
              </Link>
            )
          })}
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <div style={{
        display:'none',position:'fixed',bottom:0,left:0,right:0,zIndex:50,
        background:'var(--surface)',borderTop:'1px solid var(--border)',
        boxShadow:'0 -2px 10px rgba(26,22,18,.08)',
        paddingBottom:'env(safe-area-inset-bottom)',
      }} className="mobile-only">
        {TABS.filter(t=>t.href!=='/admin').map(t=>{
          const active=path.startsWith(t.href)
          return(
            <Link key={t.href} href={t.href} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'7px 4px 3px',fontSize:9.5,fontWeight:active?700:400,color:active?'var(--blue)':'var(--text3)',textDecoration:'none',gap:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>
              <span style={{fontSize:17,lineHeight:1}}>{t.icon}</span>
              {t.label}
            </Link>
          )
        })}
      </div>
    </>
  )
}
