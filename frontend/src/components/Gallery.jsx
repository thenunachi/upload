import { useState, useEffect, useRef, useCallback } from 'react'
import notFoundImg from '../gallery/notFoundCut.png'
import './Gallery.css'

function getGridInfo(index) {
  const block = Math.floor(index / 5), pos = index % 5
  const row = block * 2 + 1, even = block % 2 === 0
  if (even) switch (pos) {
    case 0: return { style: { gridRow: row,               gridColumn: 1 }, large: false }
    case 1: return { style: { gridRow: row,               gridColumn: 2 }, large: false }
    case 2: return { style: { gridRow: `${row}/${row+2}`, gridColumn: 3 }, large: true  }
    case 3: return { style: { gridRow: row+1,             gridColumn: 1 }, large: false }
    case 4: return { style: { gridRow: row+1,             gridColumn: 2 }, large: false }
  }
  switch (pos) {
    case 0: return { style: { gridRow: `${row}/${row+2}`, gridColumn: 1 }, large: true  }
    case 1: return { style: { gridRow: row,               gridColumn: 2 }, large: false }
    case 2: return { style: { gridRow: row,               gridColumn: 3 }, large: false }
    case 3: return { style: { gridRow: row+1,             gridColumn: 2 }, large: false }
    case 4: return { style: { gridRow: row+1,             gridColumn: 3 }, large: false }
  }
  return { style: {}, large: false }
}

function groupByDate(photos) {
  const groups = {}
  photos.forEach(p => {
    const d = new Date(p.uploaded_at)
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(p)
  })
  return Object.entries(groups).map(([label, photos]) => ({ label, photos }))
}

function PhotoCard({ photo, onOpen, onDelete, onFavorite, bulkMode, isSelected, onToggleSelect, gridStyle, large }) {
  const [loaded, setLoaded] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleDelete = (e) => {
    e.stopPropagation()
    if (confirmDel) onDelete(photo.id)
    else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500) }
  }

  return (
    <div
      className={`photo-card${large ? ' photo-card--large' : ''}${isSelected ? ' photo-selected' : ''}`}
      style={gridStyle}
      onClick={() => bulkMode ? onToggleSelect(photo.id) : onOpen(photo)}
    >
      {/* Progressive blur placeholder */}
      {!loaded && photo.blur_data && (
        <div className="photo-blur-bg" style={{ backgroundImage: `url(${photo.blur_data})` }} />
      )}
      {!loaded && !photo.blur_data && <div className="photo-skeleton" />}

      <img
        src={`/api/photos/${photo.id}/thumbnail`}
        alt={photo.original_name}
        className={`photo-thumb ${loaded ? 'visible' : ''}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />

      {bulkMode && (
        <div className={`bulk-check ${isSelected ? 'checked' : ''}`}>
          {isSelected && <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="1.5,6 5,9.5 10.5,2.5" stroke="#fff" strokeWidth="2" fill="none"/></svg>}
        </div>
      )}

      {!bulkMode && (
        <button
          className={`btn-fav ${photo.is_favorite ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); onFavorite(photo.id) }}
        >
          {photo.is_favorite ? '❤️' : '🤍'}
        </button>
      )}

      {!bulkMode && (
        <div className="photo-hover">
          <div className="hover-stats">
            <span className="hover-stat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              View
            </span>
            <span className={`hover-stat hover-del${confirmDel ? ' danger' : ''}`} onClick={handleDelete}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
              </svg>
              {confirmDel ? 'Sure?' : 'Delete'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoGrid({ photos, onOpen, onDelete, onFavorite, bulkMode, selected, onToggleSelect }) {
  return (
    <div className="gallery">
      {photos.map((photo, index) => {
        const { style, large } = getGridInfo(index)
        return (
          <PhotoCard key={photo.id} photo={photo}
            onOpen={onOpen} onDelete={onDelete} onFavorite={onFavorite}
            bulkMode={bulkMode} isSelected={selected.has(photo.id)}
            onToggleSelect={onToggleSelect} gridStyle={style} large={large}
          />
        )
      })}
    </div>
  )
}

const PAGE = 30

export default function Gallery({ photos, onOpen, onDelete, onFavorite, bulkMode, selected, onToggleSelect, grouped, showUpload, onShowUpload, searchQuery }) {
  const [visible, setVisible] = useState(PAGE)
  const sentinelRef = useRef(null)

  // Reset when source photos change (filter / sort changed)
  useEffect(() => { setVisible(PAGE) }, [photos])

  const observe = useCallback((node) => {
    if (!node) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(v => v + PAGE)
    }, { rootMargin: '300px' })
    io.observe(node)
    sentinelRef.current = io
    return () => io.disconnect()
  }, [])

  if (photos.length === 0) {
    if (searchQuery) {
      return (
        <div className="gallery-empty">
          <img src={notFoundImg} alt="Not found" className="gallery-not-found-img" />
          <p className="gallery-not-found-text">Image not found</p>
        </div>
      )
    }
    return (
      <div className="gallery-empty">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#a8a8a8" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        <p>No photos</p>
        {showUpload && <button className="btn-empty-upload" onClick={onShowUpload}>Upload your first photos</button>}
      </div>
    )
  }

  const slice = photos.slice(0, visible)
  const hasMore = visible < photos.length

  if (grouped) {
    const groups = groupByDate(slice)
    return (
      <div>
        {groups.map(g => (
          <div key={g.label} className="date-group">
            <div className="date-group-header">
              <span className="date-group-label">{g.label}</span>
              <span className="date-group-count">{g.photos.length} photo{g.photos.length !== 1 ? 's' : ''}</span>
            </div>
            <PhotoGrid photos={g.photos} onOpen={onOpen} onDelete={onDelete}
              onFavorite={onFavorite} bulkMode={bulkMode} selected={selected} onToggleSelect={onToggleSelect}/>
          </div>
        ))}
        {hasMore && <div ref={observe} className="load-sentinel"><div className="load-spinner"/></div>}
      </div>
    )
  }

  return (
    <div>
      <PhotoGrid photos={slice} onOpen={onOpen} onDelete={onDelete}
        onFavorite={onFavorite} bulkMode={bulkMode} selected={selected} onToggleSelect={onToggleSelect}/>
      {hasMore && <div ref={observe} className="load-sentinel"><div className="load-spinner"/></div>}
    </div>
  )
}
