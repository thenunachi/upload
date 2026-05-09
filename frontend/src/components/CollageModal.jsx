import { useState, useEffect } from 'react'
import './CollageModal.css'

const LAYOUTS = {
  2: [
    { id: '2h', label: 'Side by Side',  icon: <SideByIcon /> },
    { id: '2v', label: 'Top & Bottom',  icon: <TopBotIcon /> },
  ],
  3: [
    { id: '3l', label: 'Large Left',    icon: <LgLeftIcon /> },
    { id: '3r', label: 'Large Right',   icon: <LgRightIcon /> },
  ],
  4: [
    { id: '4',  label: '2×2 Grid',      icon: <GridIcon /> },
  ],
}

function SideByIcon()  { return <svg viewBox="0 0 40 28" className="li"><rect x="1" y="1" width="17" height="26" rx="1"/><rect x="22" y="1" width="17" height="26" rx="1"/></svg> }
function TopBotIcon()  { return <svg viewBox="0 0 28 40" className="li"><rect x="1" y="1" width="26" height="17" rx="1"/><rect x="1" y="22" width="26" height="17" rx="1"/></svg> }
function LgLeftIcon()  { return <svg viewBox="0 0 40 28" className="li"><rect x="1" y="1" width="22" height="26" rx="1"/><rect x="26" y="1" width="13" height="12" rx="1"/><rect x="26" y="16" width="13" height="11" rx="1"/></svg> }
function LgRightIcon() { return <svg viewBox="0 0 40 28" className="li"><rect x="1" y="1" width="13" height="12" rx="1"/><rect x="1" y="16" width="13" height="11" rx="1"/><rect x="17" y="1" width="22" height="26" rx="1"/></svg> }
function GridIcon()    { return <svg viewBox="0 0 28 28" className="li"><rect x="1" y="1" width="12" height="12" rx="1"/><rect x="15" y="1" width="12" height="12" rx="1"/><rect x="1" y="15" width="12" height="12" rx="1"/><rect x="15" y="15" width="12" height="12" rx="1"/></svg> }

export default function CollageModal({ initialIds = [], allPhotos = [], onClose, onCreated }) {
  const [ids, setIds] = useState(initialIds.slice(0, 4))
  const [layout, setLayout] = useState(() => initialIds.length >= 4 ? '4' : initialIds.length === 3 ? '3l' : '2h')
  const [gap, setGap] = useState(6)
  const [bg, setBg] = useState('#ffffff')
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  // Reset layout when count changes
  useEffect(() => {
    const opts = LAYOUTS[Math.min(Math.max(ids.length, 2), 4)] || []
    if (!opts.find(o => o.id === layout)) setLayout(opts[0]?.id || '2h')
  }, [ids.length])

  const toggle = (id) => {
    setIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  const remove = (id) => setIds(prev => prev.filter(x => x !== id))

  const create = async () => {
    if (ids.length < 2) return
    setSaving(true)
    try {
      const res = await fetch('/api/collage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: ids, layout, gap, bg }),
      })
      if (res.ok) { onCreated(); onClose() }
    } finally { setSaving(false) }
  }

  const count = ids.length
  const layoutOpts = LAYOUTS[Math.min(Math.max(count, 2), 4)] || LAYOUTS[2]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="collage-modal" onClick={e => e.stopPropagation()}>

        <div className="collage-header">
          <h3>Create Collage</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Selected photos strip */}
        <div className="collage-selected">
          <span className="collage-selected-label">{count} / 4 photos</span>
          <div className="collage-slots">
            {ids.map(id => {
              const p = allPhotos.find(p => p.id === id)
              return (
                <div key={id} className="collage-slot">
                  <img src={`/api/photos/${id}/thumbnail`} alt={p?.original_name} />
                  <button className="collage-slot-remove" onClick={() => remove(id)}>×</button>
                </div>
              )
            })}
            {ids.length < 4 && (
              <button className="collage-slot collage-slot-add" onClick={() => setShowPicker(p => !p)}>
                + Add
              </button>
            )}
          </div>
        </div>

        {/* Photo picker */}
        {showPicker && (
          <div className="collage-picker">
            <p className="collage-picker-hint">Click a photo to add (max 4)</p>
            <div className="collage-picker-grid">
              {allPhotos.filter(p => !ids.includes(p.id)).map(p => (
                <div key={p.id} className="collage-pick-item" onClick={() => { toggle(p.id); if (ids.length >= 3) setShowPicker(false) }}>
                  <img src={`/api/photos/${p.id}/thumbnail`} alt={p.original_name} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Layout picker */}
        {count >= 2 && (
          <div className="collage-layouts">
            <span className="ctrl-label">Layout</span>
            <div className="collage-layout-row">
              {layoutOpts.map(opt => (
                <button
                  key={opt.id}
                  className={`collage-layout-btn ${layout === opt.id ? 'active' : ''}`}
                  onClick={() => setLayout(opt.id)}
                  title={opt.label}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="collage-options">
          <div className="collage-opt">
            <span className="ctrl-label">Gap</span>
            <input type="range" min={0} max={30} value={gap} onChange={e => setGap(+e.target.value)} />
            <span className="slider-val">{gap}px</span>
          </div>
          <div className="collage-opt">
            <span className="ctrl-label">Background</span>
            <div className="collage-bgs">
              {['#ffffff','#000000','#1a1a1a','#f5e6d0','#e8f4f8'].map(c => (
                <button key={c} className={`wm-color ${bg===c?'active':''}`}
                  style={{ background: c }} onClick={() => setBg(c)} />
              ))}
              <input type="color" value={bg} onChange={e => setBg(e.target.value)} className="wm-color-pick" />
            </div>
          </div>
        </div>

        <div className="edit-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={create} disabled={saving || count < 2}>
            {saving ? 'Creating…' : '🖼 Create Collage'}
          </button>
        </div>

      </div>
    </div>
  )
}
