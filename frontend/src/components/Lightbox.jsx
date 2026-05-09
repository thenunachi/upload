import { useEffect, useCallback, useState, useRef } from 'react'
import BeforeAfter from './BeforeAfter.jsx'
import './Lightbox.css'

const SPEEDS = [2, 4, 6, 10]

function fmtSize(b) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function Lightbox({ photo, index, total, onClose, onNav, onDelete, onShare, onEdit, onFavorite, onTagsChange }) {
  const [playing, setPlaying] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const [progress, setProgress] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)

  // Zoom + pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const lastPinchDist = useRef(null)

  // EXIF
  const [exif, setExif] = useState(null)
  const [showExif, setShowExif] = useState(false)

  // Tags
  const [tags, setTags] = useState(photo.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [allTags, setAllTags] = useState([])

  const progressRef = useRef(0)
  const timerRef = useRef(null)
  const onNavRef = useRef(onNav)
  useEffect(() => { onNavRef.current = onNav }, [onNav])

  useEffect(() => { progressRef.current = 0; setProgress(0) }, [index])

  // Reset zoom & pan when navigating
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setExif(null); setShowExif(false) }, [photo.id])

  // Sync tags when photo changes
  useEffect(() => { setTags(photo.tags || []) }, [photo.id, photo.tags])

  // Fetch all tags for autocomplete
  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setAllTags).catch(() => {})
  }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (!playing) return
    const speed = SPEEDS[speedIdx]
    timerRef.current = setInterval(() => {
      progressRef.current += 100 / (speed * 10)
      if (progressRef.current >= 100) {
        progressRef.current = 0; setProgress(0); onNavRef.current(1)
      } else {
        setProgress(progressRef.current)
      }
    }, 100)
    return () => clearInterval(timerRef.current)
  }, [playing, speedIdx])

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && zoom === 1) onNav(-1)
    if (e.key === 'ArrowRight' && zoom === 1) onNav(1)
    if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
  }, [onClose, onNav, zoom])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
      clearInterval(timerRef.current)
    }
  }, [handleKey])

  const handleDelete = () => {
    if (confirmDel) { onDelete(photo.id) }
    else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500) }
  }

  // ── Zoom handlers ──
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.12 : 0.9
    setZoom(prev => {
      const next = Math.min(Math.max(prev * factor, 1), 6)
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    e.preventDefault()
  }, [zoom, pan])

  const handleMouseMove = useCallback((e) => {
    if (!dragging.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx) / zoom,
      y: dragStart.current.py + (e.clientY - dragStart.current.my) / zoom,
    })
  }, [zoom])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleDblClick = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      if (lastPinchDist.current) {
        const ratio = dist / lastPinchDist.current
        setZoom(prev => Math.min(Math.max(prev * ratio, 1), 6))
      }
      lastPinchDist.current = dist
    }
  }, [])

  const handleTouchEnd = useCallback(() => { lastPinchDist.current = null }, [])

  // ── EXIF ──
  const loadExif = async () => {
    if (exif !== null) { setShowExif(v => !v); return }
    const data = await fetch(`/api/photos/${photo.id}/exif`).then(r => r.json()).catch(() => ({}))
    setExif(data)
    setShowExif(true)
  }

  // ── Tags ──
  const addTag = async (name) => {
    const t = name.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    await fetch(`/api/photos/${photo.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t }),
    })
    const next = [...tags, t]
    setTags(next)
    setTagInput('')
    onTagsChange?.(photo.id, next)
  }

  const removeTag = async (t) => {
    await fetch(`/api/photos/${photo.id}/tags/${encodeURIComponent(t)}`, { method: 'DELETE' })
    const next = tags.filter(x => x !== t)
    setTags(next)
    onTagsChange?.(photo.id, next)
  }

  const suggestions = tagInput
    ? allTags.filter(t => t.name.includes(tagInput) && !tags.includes(t.name)).slice(0, 5)
    : []

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <div className="lb-post" onClick={e => e.stopPropagation()}>

        {/* ── Photo panel ── */}
        <div
          className="lb-photo-panel"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDblClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        >
          {total > 1 && !comparing && zoom === 1 && (
            <button className="lb-arrow lb-arrow-l" onClick={() => onNav(-1)}>&#8249;</button>
          )}
          {comparing && photo.parent_id ? (
            <BeforeAfter
              beforeSrc={`/api/photos/${photo.parent_id}/image`}
              afterSrc={`/api/photos/${photo.id}/image`}
            />
          ) : (
            <img
              key={photo.id}
              src={`/api/photos/${photo.id}/image`}
              alt={photo.original_name}
              className="lb-image"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transition: dragging.current ? 'none' : 'transform 0.15s ease',
              }}
              draggable={false}
            />
          )}
          {total > 1 && !comparing && zoom === 1 && (
            <button className="lb-arrow lb-arrow-r" onClick={() => onNav(1)}>&#8250;</button>
          )}
          {zoom > 1 && (
            <div className="lb-zoom-badge">{Math.round(zoom * 10) / 10}×</div>
          )}
          {playing && (
            <div className="lb-prog-bar">
              <div className="lb-prog-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* ── Info panel ── */}
        <div className="lb-info-panel">

          {/* Header */}
          <div className="lb-panel-header">
            <div className="lb-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="#fff" stroke="none"/>
              </svg>
            </div>
            <span className="lb-panel-name">{photo.original_name}</span>
            <button className="lb-close" onClick={onClose}>&#10005;</button>
          </div>

          <div className="lb-sep" />

          {/* Meta */}
          <div className="lb-meta">
            {photo.width && photo.height && (
              <div className="lb-meta-row">
                <span className="lb-meta-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a8a8" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </span>
                <span>{photo.width} × {photo.height} px</span>
              </div>
            )}
            <div className="lb-meta-row">
              <span className="lb-meta-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a8a8" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </span>
              <span>{fmtSize(photo.size)}</span>
            </div>
            {photo.uploaded_at && (
              <div className="lb-meta-row">
                <span className="lb-meta-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a8a8" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </span>
                <span>{fmtDate(photo.uploaded_at)}</span>
              </div>
            )}
            {total > 1 && (
              <div className="lb-meta-row">
                <span className="lb-meta-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a8a8" strokeWidth="2">
                    <path d="M18 3a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6z"/>
                    <path d="M6 21a3 3 0 0 1 0-6h12a3 3 0 0 1 0 6z"/>
                  </svg>
                </span>
                <span>{index + 1} of {total}</span>
              </div>
            )}
          </div>

          <div className="lb-sep" />

          {/* Action icons */}
          <div className="lb-actions">
            <button
              className={`lb-act ${photo.is_favorite ? 'lb-act-fav-on' : ''}`}
              title={photo.is_favorite ? 'Unfavorite' : 'Favorite'}
              onClick={() => onFavorite(photo.id)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={photo.is_favorite ? '#ed4956' : 'none'} stroke={photo.is_favorite ? '#ed4956' : 'currentColor'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{photo.is_favorite ? 'Unfav' : 'Favorite'}</span>
            </button>
            {photo.parent_id && (
              <button
                className={`lb-act ${comparing ? 'lb-act-active' : ''}`}
                title="Compare original vs edited"
                onClick={() => setComparing(c => !c)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="9" height="18" rx="1"/>
                  <rect x="13" y="3" width="9" height="18" rx="1"/>
                  <line x1="11.5" y1="3" x2="11.5" y2="21"/>
                </svg>
                <span>{comparing ? 'Hide' : 'Compare'}</span>
              </button>
            )}
            <button className="lb-act" title="Edit" onClick={onEdit}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Edit</span>
            </button>
            <button className="lb-act" title="Share" onClick={onShare}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span>Share</span>
            </button>
            <a className="lb-act" title="Download" href={`/api/photos/${photo.id}/image`} download={photo.original_name}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Download</span>
            </a>
            <button
              className={`lb-act lb-act-del ${confirmDel ? 'danger' : ''}`}
              title="Delete"
              onClick={handleDelete}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              <span>{confirmDel ? 'Confirm?' : 'Delete'}</span>
            </button>
          </div>

          <div className="lb-sep" />

          {/* Tags */}
          <div className="lb-tags-section">
            <div className="lb-tags-list">
              {tags.map(t => (
                <span key={t} className="lb-tag">
                  {t}
                  <button className="lb-tag-rm" onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
            </div>
            <div className="lb-tag-input-wrap">
              <input
                className="lb-tag-input"
                placeholder="Add tag…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTag(tagInput) }}
              />
              {tagInput && <button className="lb-tag-add-btn" onClick={() => addTag(tagInput)}>+</button>}
            </div>
            {suggestions.length > 0 && (
              <div className="lb-tag-suggestions">
                {suggestions.map(t => (
                  <button key={t.name} className="lb-tag-sug" onClick={() => addTag(t.name)}>{t.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="lb-sep" />

          {/* EXIF */}
          <div className="lb-exif-section">
            <button className="lb-exif-toggle" onClick={loadExif}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07"/>
                <path d="M4.93 4.93A10 10 0 0 1 19.07 19.07"/>
              </svg>
              Camera info {showExif ? '▲' : '▼'}
            </button>
            {showExif && exif && (
              <div className="lb-exif-grid">
                {exif.make && <><span className="lb-exif-key">Make</span><span>{exif.make}</span></>}
                {exif.model && <><span className="lb-exif-key">Model</span><span>{exif.model}</span></>}
                {exif.date_taken && <><span className="lb-exif-key">Taken</span><span>{exif.date_taken}</span></>}
                {exif.shutter && <><span className="lb-exif-key">Shutter</span><span>{exif.shutter}</span></>}
                {exif.aperture && <><span className="lb-exif-key">Aperture</span><span>{exif.aperture}</span></>}
                {exif.iso && <><span className="lb-exif-key">ISO</span><span>{exif.iso}</span></>}
                {exif.focal_length && <><span className="lb-exif-key">Focal</span><span>{exif.focal_length}</span></>}
                {exif.flash && <><span className="lb-exif-key">Flash</span><span>{exif.flash}</span></>}
                {exif.gps && (
                  <><span className="lb-exif-key">GPS</span>
                  <span>{exif.gps.lat.toFixed(4)}, {exif.gps.lng.toFixed(4)}</span></>
                )}
                {Object.keys(exif).filter(k => k !== 'gps').length === 0 && !exif.gps && (
                  <span className="lb-exif-empty">No EXIF data found</span>
                )}
              </div>
            )}
            {showExif && exif && Object.keys(exif).length === 0 && (
              <p className="lb-exif-empty">No EXIF data found</p>
            )}
          </div>

          <div className="lb-sep" />

          {/* Slideshow */}
          {total > 1 && (
            <div className="lb-slideshow">
              <button
                className={`lb-play-btn ${playing ? 'on' : ''}`}
                onClick={() => setPlaying(p => !p)}
              >
                {playing ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
                    Slideshow
                  </>
                )}
              </button>
              {playing && (
                <button className="lb-speed-btn" onClick={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}>
                  {SPEEDS[speedIdx]}s
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
