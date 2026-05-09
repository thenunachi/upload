import { useState } from 'react'
import './BulkBar.css'

export default function BulkBar({ count, selectedIds, onFavorite, onAddToAlbum, onDelete, onCollage, onCancel }) {
  const [zipping, setZipping] = useState(false)

  if (count === 0) return null

  const handleZip = async () => {
    setZipping(true)
    try {
      const res = await fetch('/api/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: selectedIds }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photos_${count}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="bulk-bar">
      <span className="bulk-count">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="var(--accent)" strokeWidth="2"/>
        </svg>
        {count} selected
      </span>

      <div className="bulk-actions">
        <button className="bulk-btn" onClick={onFavorite}>❤️ Favorite</button>
        <button className="bulk-btn" onClick={onAddToAlbum}>🗂 Album</button>
        {count >= 2 && count <= 4 && (
          <button className="bulk-btn" onClick={onCollage}>🖼 Collage</button>
        )}
        <button className="bulk-btn" onClick={handleZip} disabled={zipping}>
          {zipping ? '⏳ Zipping…' : '⬇ ZIP'}
        </button>
        <button className="bulk-btn bulk-btn-del" onClick={onDelete}>🗑 Delete</button>
      </div>

      <button className="bulk-cancel" onClick={onCancel}>✕ Cancel</button>
    </div>
  )
}
