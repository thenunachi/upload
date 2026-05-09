import { useState, useRef } from 'react'
import BeforeAfter from './BeforeAfter.jsx'
import './EditModal.css'

// ── Frame styles ──────────────────────────────────────────────────────────────
const FRAMES = [
  { id: 'white',       label: 'White',    css: { padding: '10px', background: '#fff' } },
  { id: 'thick_white', label: 'Thick',    css: { padding: '26px', background: '#fff' } },
  { id: 'black',       label: 'Black',    css: { padding: '10px', background: '#0c0c0c' } },
  { id: 'polaroid',    label: 'Polaroid', css: { padding: '10px 10px 48px', background: '#fff' } },
  { id: 'shadow',      label: 'Shadow',   css: { padding: '10px', background: '#1a1a1a' } },
  { id: 'film',        label: 'Film',     css: { padding: '14px', background: '#080808' } },
  { id: 'vintage',     label: 'Vintage',  css: { padding: '10px', background: '#be9f64' } },
]

// ── Position picker labels ────────────────────────────────────────────────────
const POSITIONS = ['tl','tc','tr','ml','mc','mr','bl','bc','br']
const POS_LABEL  = { tl:'↖',tc:'↑',tr:'↗', ml:'←',mc:'·',mr:'→', bl:'↙',bc:'↓',br:'↘' }
const POS_STYLE  = {
  tl:{ top:'6%',  left:'6%' },   tc:{ top:'6%',  left:'50%', transform:'translateX(-50%)' },
  tr:{ top:'6%',  right:'6%' },  ml:{ top:'50%', left:'6%',  transform:'translateY(-50%)' },
  mc:{ top:'50%', left:'50%',   transform:'translate(-50%,-50%)' },
  mr:{ top:'50%', right:'6%',  transform:'translateY(-50%)' },
  bl:{ bottom:'6%',left:'6%' }, bc:{ bottom:'6%',left:'50%',transform:'translateX(-50%)' },
  br:{ bottom:'6%',right:'6%' },
}

const WM_COLORS = ['#ffffff','#000000','#ffff00','#ff4444','#44aaff','#44ff88']

export default function EditModal({ photo, onClose, onSaved }) {
  const [tab, setTab] = useState('transform')

  // Transform
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)

  // Crop
  const [cropBox, setCropBox] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const wrapperRef = useRef(null)

  // Filters
  const [brightness, setBrightness] = useState(1)
  const [contrast, setContrast] = useState(1)
  const [saturation, setSaturation] = useState(1)

  // Frame
  const [selectedFrame, setSelectedFrame] = useState(null)

  // Watermark
  const [wmText, setWmText] = useState('')
  const [wmSize, setWmSize] = useState(48)
  const [wmColor, setWmColor] = useState('#ffffff')
  const [wmOpacity, setWmOpacity] = useState(0.8)
  const [wmPos, setWmPos] = useState('br')

  // Stickers
  const [stickers, setStickers] = useState([])
  const [dragIdx, setDragIdx] = useState(null)
  const stickerRef = useRef(null)

  const [saving, setSaving] = useState(false)

  const imgTransform = `rotate(${rotation}deg) scaleX(${flipH?-1:1}) scaleY(${flipV?-1:1})`
  const imgFilter    = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`

  // Crop handlers
  const getPos = (e) => {
    const rect = wrapperRef.current.getBoundingClientRect()
    return { x: Math.max(0,Math.min(e.clientX-rect.left,rect.width)), y: Math.max(0,Math.min(e.clientY-rect.top,rect.height)) }
  }
  const onMouseDown = (e) => { if(tab!=='crop') return; e.preventDefault(); setDragStart(getPos(e)); setCropBox(null) }
  const onMouseMove = (e) => {
    if(!dragStart) return
    const p=getPos(e)
    setCropBox({ x:Math.min(dragStart.x,p.x), y:Math.min(dragStart.y,p.y), w:Math.abs(p.x-dragStart.x), h:Math.abs(p.y-dragStart.y) })
  }
  const onMouseUp = () => { if(cropBox&&(cropBox.w<10||cropBox.h<10)) setCropBox(null); setDragStart(null) }

  const hasChanges =
    (tab==='frame'     && selectedFrame !== null) ||
    (tab==='watermark' && wmText.trim().length > 0) ||
    (tab==='stickers'  && stickers.length > 0) ||
    (tab!=='frame' && tab!=='watermark' && tab!=='compare' && tab!=='stickers' &&
      (rotation!==0 || flipH || flipV || (cropBox&&cropBox.w>10) || brightness!==1 || contrast!==1 || saturation!==1))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (tab === 'stickers') { applyStickersSave(); return }
      let res
      if (tab === 'frame') {
        res = await fetch(`/api/photos/${photo.id}/frame`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ style: selectedFrame })
        })
      } else if (tab === 'watermark') {
        res = await fetch(`/api/photos/${photo.id}/watermark`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ text:wmText, font_size:wmSize, color:wmColor, opacity:wmOpacity, position:wmPos })
        })
      } else {
        const body = { rotate:rotation, flip_h:flipH, flip_v:flipV, brightness, contrast, saturation }
        if (cropBox&&cropBox.w>10&&cropBox.h>10&&wrapperRef.current) {
          const rect=wrapperRef.current.getBoundingClientRect()
          body.crop = { x:cropBox.x/rect.width, y:cropBox.y/rect.height, w:cropBox.w/rect.width, h:cropBox.h/rect.height }
        }
        res = await fetch(`/api/photos/${photo.id}/edit`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
        })
      }
      if (res.ok) { onSaved(); onClose() }
    } finally { setSaving(false) }
  }

  const saveLabel = tab==='frame' ? 'Apply Frame' : tab==='watermark' ? 'Apply Watermark' : tab==='stickers' ? 'Apply Stickers' : 'Save as New'

  // Sticker drag
  const stickerMove = (e) => {
    if (dragIdx === null || !stickerRef.current) return
    const rect = stickerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100))
    const y = Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100))
    setStickers(s => s.map((st, i) => i === dragIdx ? { ...st, x, y } : st))
  }

  // Canvas-based sticker apply
  const applyStickersSave = async () => {
    setSaving(true)
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const scale = img.naturalWidth / (stickerRef.current?.getBoundingClientRect().width || 400)
      stickers.forEach(st => {
        ctx.font = `${st.size * scale}px serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(st.emoji, st.x / 100 * canvas.width, st.y / 100 * canvas.height)
      })
      canvas.toBlob(async (blob) => {
        const form = new FormData()
        form.append('files', new File([blob], `stickered_${photo.original_name}.jpg`, { type: 'image/jpeg' }))
        const res = await fetch('/api/photos', { method: 'POST', body: form })
        if (res.ok) { onSaved(); onClose() }
        setSaving(false)
      }, 'image/jpeg', 0.92)
    }
    img.src = `/api/photos/${photo.id}/image`
  }

  const TABS = [
    { id:'crop',      label:'✂ Crop'      },
    { id:'transform', label:'↻ Transform' },
    { id:'filters',   label:'◑ Filters'   },
    { id:'frame',     label:'🖼 Frame'     },
    { id:'watermark', label:'💧 Watermark' },
    { id:'stickers',  label:'🎪 Stickers'  },
    { id:'compare',   label:'◀▶ Compare'  },
  ]

  // Build preview wrapper
  const frameStyle = tab==='frame' && selectedFrame
    ? FRAMES.find(f=>f.id===selectedFrame)?.css || {}
    : {}

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="edit-modal" onClick={e=>e.stopPropagation()}>

        <div className="edit-header">
          <h3>Edit Photo</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="edit-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`edit-tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="edit-preview-area">
          {tab==='compare' ? (
            <BeforeAfter
              beforeSrc={`/api/photos/${photo.id}/image`}
              afterStyle={{ transform:imgTransform, filter:imgFilter }}
            />
          ) : tab==='frame' ? (
            <div className="frame-preview-outer" style={frameStyle}>
              <img src={`/api/photos/${photo.id}/image`} className="edit-img frame-img" draggable={false}/>
              {selectedFrame==='film' && (
                <div className="film-holes-l">
                  {[...Array(6)].map((_,i)=><div key={i} className="film-hole"/>)}
                </div>
              )}
            </div>
          ) : tab==='stickers' ? (
            <div
              className="sticker-preview-wrap"
              ref={stickerRef}
              onPointerMove={stickerMove}
              onPointerUp={() => setDragIdx(null)}
            >
              <img src={`/api/photos/${photo.id}/image`} className="edit-img" draggable={false} alt="" />
              {stickers.map((st, i) => (
                <span
                  key={st.id}
                  className={`sticker-item ${dragIdx === i ? 'dragging' : ''}`}
                  style={{ left: `${st.x}%`, top: `${st.y}%`, fontSize: `${st.size}px` }}
                  onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setDragIdx(i) }}
                >
                  {st.emoji}
                  <button className="sticker-remove" onClick={e => { e.stopPropagation(); setStickers(s => s.filter((_,j) => j !== i)) }}>×</button>
                </span>
              ))}
            </div>
          ) : tab==='watermark' ? (
            <div className="wm-preview-wrap" ref={wrapperRef}>
              <img src={`/api/photos/${photo.id}/image`} className="edit-img" draggable={false}/>
              {wmText && (
                <span className="wm-overlay-text" style={{ ...POS_STYLE[wmPos], fontSize:wmSize*0.45+'px', color:wmColor, opacity:wmOpacity }}>
                  {wmText}
                </span>
              )}
            </div>
          ) : (
            <div
              className={`edit-img-wrapper ${tab==='crop'?'crop-mode':''}`}
              ref={wrapperRef}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove}
              onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            >
              <img
                src={`/api/photos/${photo.id}/image`}
                alt={photo.original_name}
                className="edit-img"
                style={tab==='crop'?{filter:imgFilter}:{transform:imgTransform,filter:imgFilter}}
                draggable={false}
              />
              {tab==='crop'&&cropBox&&cropBox.w>4&&cropBox.h>4&&(
                <div className="crop-selection" style={{left:cropBox.x,top:cropBox.y,width:cropBox.w,height:cropBox.h}}/>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="edit-controls">
          {tab==='compare' && <span className="ctrl-hint">Drag the handle to compare original vs your edits</span>}

          {tab==='stickers' && (
            <div className="sticker-controls">
              <span className="ctrl-hint">Click a sticker to add, then drag it on the photo</span>
              <div className="sticker-palette">
                {['😀','😂','❤️','🔥','⭐','✨','🎉','🦋','🌈','🌸','🎨','📷','🤳','💫','🚀','🐝','🦄','💎','🌊','🍀'].map(e => (
                  <button key={e} className="sticker-pick" onClick={() =>
                    setStickers(s => [...s, { id: Date.now(), emoji: e, x: 50, y: 50, size: 48 }])
                  }>{e}</button>
                ))}
              </div>
              {stickers.length > 0 && (
                <button className="btn-sm" onClick={() => setStickers([])}>Clear all</button>
              )}
            </div>
          )}

          {tab==='crop' && (
            <div className="crop-controls">
              <span className="ctrl-hint">Drag on the image to select the crop area</span>
              {cropBox&&cropBox.w>10&&<button className="btn-sm" onClick={()=>setCropBox(null)}>Clear</button>}
            </div>
          )}

          {tab==='transform' && (
            <div className="transform-controls">
              <div className="ctrl-group">
                <span className="ctrl-label">Rotate</span>
                <div className="btn-row">
                  <button onClick={()=>setRotation(r=>(r-90+360)%360)}>↺ 90° CCW</button>
                  <button onClick={()=>setRotation(r=>(r+90)%360)}>↻ 90° CW</button>
                  <button onClick={()=>setRotation(r=>(r+180)%360)}>180°</button>
                  {rotation!==0&&<button onClick={()=>setRotation(0)}>Reset</button>}
                </div>
                {rotation!==0&&<span className="ctrl-val">Current: {rotation}°</span>}
              </div>
              <div className="ctrl-group">
                <span className="ctrl-label">Flip</span>
                <div className="btn-row">
                  <button className={flipH?'active':''} onClick={()=>setFlipH(f=>!f)}>⇆ Horizontal</button>
                  <button className={flipV?'active':''} onClick={()=>setFlipV(f=>!f)}>⇅ Vertical</button>
                </div>
              </div>
            </div>
          )}

          {tab==='filters' && (
            <div className="filter-controls">
              {[['Brightness',brightness,setBrightness,0.1,3],['Contrast',contrast,setContrast,0.1,3],['Saturation',saturation,setSaturation,0,3]].map(([l,v,s,mn,mx])=>(
                <div key={l} className="slider-row">
                  <div className="slider-label-row"><span>{l}</span><span className="slider-val">{v.toFixed(2)}</span></div>
                  <input type="range" min={mn} max={mx} step="0.05" value={v} onChange={e=>s(parseFloat(e.target.value))}/>
                </div>
              ))}
              <button className="btn-sm" onClick={()=>{setBrightness(1);setContrast(1);setSaturation(1)}}>Reset Filters</button>
            </div>
          )}

          {tab==='frame' && (
            <div className="frame-controls">
              <span className="ctrl-label">Pick a frame style</span>
              <div className="frame-grid">
                {FRAMES.map(f=>(
                  <button
                    key={f.id}
                    className={`frame-card ${selectedFrame===f.id?'active':''}`}
                    onClick={()=>setSelectedFrame(f.id)}
                    style={f.css}
                  >
                    <img src={`/api/photos/${photo.id}/thumbnail`} className="frame-card-img"/>
                    <span className="frame-card-label">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab==='watermark' && (
            <div className="wm-controls">
              <div className="wm-row">
                <input
                  className="wm-text-input"
                  placeholder="Watermark text…"
                  value={wmText}
                  onChange={e=>setWmText(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="wm-row wm-row-split">
                <div className="wm-field">
                  <span className="ctrl-label">Size</span>
                  <input type="range" min={12} max={120} value={wmSize} onChange={e=>setWmSize(+e.target.value)}/>
                  <span className="slider-val">{wmSize}px</span>
                </div>
                <div className="wm-field">
                  <span className="ctrl-label">Opacity</span>
                  <input type="range" min={0.1} max={1} step={0.05} value={wmOpacity} onChange={e=>setWmOpacity(parseFloat(e.target.value))}/>
                  <span className="slider-val">{Math.round(wmOpacity*100)}%</span>
                </div>
              </div>
              <div className="wm-row wm-row-split">
                <div className="wm-field">
                  <span className="ctrl-label">Color</span>
                  <div className="wm-colors">
                    {WM_COLORS.map(c=>(
                      <button key={c} className={`wm-color ${wmColor===c?'active':''}`}
                        style={{background:c}} onClick={()=>setWmColor(c)}/>
                    ))}
                    <input type="color" value={wmColor} onChange={e=>setWmColor(e.target.value)} className="wm-color-pick" title="Custom color"/>
                  </div>
                </div>
                <div className="wm-field">
                  <span className="ctrl-label">Position</span>
                  <div className="wm-pos-grid">
                    {POSITIONS.map(p=>(
                      <button key={p} className={`wm-pos-btn ${wmPos===p?'active':''}`} onClick={()=>setWmPos(p)}>
                        {POS_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="edit-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={saving||!hasChanges}>
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
