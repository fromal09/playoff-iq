'use client'
import { useState, useRef } from 'react'

interface UploadResult {
  type: 'success' | 'error'
  message: string
  details?: string[]
}

export default function UploadPage() {
  const [playerFile, setPlayerFile] = useState<File|null>(null)
  const [teamFile,   setTeamFile]   = useState<File|null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [result,     setResult]     = useState<UploadResult|null>(null)
  const playerRef = useRef<HTMLInputElement>(null)
  const teamRef   = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!playerFile && !teamFile) { setResult({type:'error',message:'Select at least one CSV.'}); return }
    setUploading(true); setResult(null)
    const form = new FormData()
    if (playerFile) form.append('players', playerFile)
    if (teamFile)   form.append('teams',   teamFile)
    try {
      const res  = await fetch('/api/upload', { method:'POST', body: form })
      const json = await res.json()
      if (res.ok) {
        setResult({type:'success', message:json.message, details:json.details})
        setPlayerFile(null); setTeamFile(null)
        if (playerRef.current) playerRef.current.value = ''
        if (teamRef.current)   teamRef.current.value   = ''
      } else {
        setResult({type:'error', message:json.error??'Upload failed.', details:json.details})
      }
    } catch(e) { setResult({type:'error', message:String(e)}) }
    setUploading(false)
  }

  function FileCard({label,file,inputRef,onChange}:{label:string;file:File|null;inputRef:React.RefObject<HTMLInputElement|null>;onChange:(f:File|null)=>void}) {
    return (
      <div className="card2" style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:16,letterSpacing:'0.05em'}}>{label}</div>
        <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
          Same column layout as the initial Stathead export. New rows upsert — existing (player, date) pairs are replaced.
        </div>
        <div style={{border:'2px dashed var(--border2)',borderRadius:8,padding:'28px 20px',textAlign:'center',cursor:'pointer',background:file?'var(--gold-dim)':'transparent',transition:'background .2s'}}
          onClick={()=>inputRef.current?.click()}>
          {file ? (
            <div><div style={{color:'var(--gold)',fontWeight:600,marginBottom:4}}>✓ {file.name}</div><div style={{fontSize:12,color:'var(--text2)'}}>{(file.size/1024).toFixed(1)} KB</div></div>
          ) : (
            <div><div style={{fontSize:24,marginBottom:8}}>📄</div><div style={{color:'var(--text2)',fontSize:13}}>Click to choose CSV</div></div>
          )}
          <input ref={inputRef as React.RefObject<HTMLInputElement>} type="file" accept=".csv" style={{display:'none'}} onChange={e=>onChange(e.target.files?.[0]??null)}/>
        </div>
        {file && <button className="btn" style={{fontSize:11,padding:'3px 8px',alignSelf:'flex-start'}} onClick={e=>{e.stopPropagation();onChange(null);if(inputRef.current)inputRef.current.value=''}}>Remove</button>}
      </div>
    )
  }

  return (
    <div style={{maxWidth:720,margin:'40px auto',padding:'0 20px'}}>
      <h1 style={{fontSize:32,color:'var(--gold)',marginBottom:8}}>BATCH UPLOAD</h1>
      <p style={{color:'var(--text2)',fontSize:14,marginBottom:28,lineHeight:1.6}}>
        Upload new game CSVs as the playoffs progress. The processor derives series context, computes era-adjusted GmSc, and upserts all rows. Both files use the same format as the initial import.
      </p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
        <FileCard label="Player Games CSV" file={playerFile} inputRef={playerRef} onChange={setPlayerFile}/>
        <FileCard label="Team Games CSV"   file={teamFile}   inputRef={teamRef}   onChange={setTeamFile}/>
      </div>
      <button className="btn btn-gold" style={{padding:'10px 24px',fontSize:14,justifyContent:'center',width:'100%'}}
        disabled={uploading||(!playerFile&&!teamFile)} onClick={handleUpload}>
        {uploading ? <><div className="spinner" style={{width:14,height:14}}/>Processing…</> : 'Process & Upload'}
      </button>
      {result && (
        <div style={{marginTop:20,padding:16,borderRadius:8,background:result.type==='success'?'var(--green-dim)':'var(--red-dim)',border:`1px solid ${result.type==='success'?'rgba(29,185,122,.3)':'rgba(232,85,85,.3)'}`}}>
          <div style={{fontWeight:600,color:result.type==='success'?'var(--green)':'var(--red)',marginBottom:8}}>
            {result.type==='success'?'✓ ':'✗ '}{result.message}
          </div>
          {result.details?.map((d,i)=><div key={i} style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{d}</div>)}
        </div>
      )}
      <div style={{marginTop:32,fontSize:13,color:'var(--text2)',lineHeight:1.8}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:16,letterSpacing:'0.04em',color:'var(--text)',marginBottom:8}}>COLUMN FORMAT</div>
        <div style={{fontFamily:'monospace',fontSize:11,background:'var(--bg2)',padding:16,borderRadius:8,lineHeight:2,border:'1px solid var(--border)'}}>
          <div style={{color:'var(--gold)'}}>Player Games (order matters):</div>
          <div>Rk · Player · GmSc · Date · Age · Team · @/N · Opp · Result · GS · MP</div>
          <div>FG FGA FG% · 2P 2PA 2P% · 3P 3PA 3P% · FT FTA FT% · TS%</div>
          <div>ORB DRB TRB · AST STL BLK TOV PF PTS · GmSc · BPM · #ERROR! · Pos.</div>
          <div style={{marginTop:8,color:'var(--gold)'}}>Team Games (order matters):</div>
          <div>Rk · Team · Date · PTS · @/N · Opp · Result · MP · FG…FT%(team) · PTS · FG…FT%(opp) · PTS(opp)</div>
        </div>
      </div>
    </div>
  )
}
