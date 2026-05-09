import { useState, useEffect } from 'react'
import './TrashModal.css'

function daysLeft(deletedAt) {
  const ms = 7 * 86400000 - (Date.now() - new Date(deletedAt).getTime())
  return Math.max(0, Math.ceil(ms / 86400000))
}

export default function TrashModal({ onClose, onRestored }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [emptying, setEmptying] = useState(false)

  const load = async () => {
    const data = await fetch('/api/trash').then(r => r.json())
    setItems(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const restore = async (id) => {
    await fetch(`/api/photos/${id}/restore`, { method: 'POST' })
    setItems(prev => prev.filter(p => p.id !== id))
    onRestored()
  }

  const emptyTrash = async () => {
    if (!confirm('Permanently delete all trashed photos? This cannot be undone.')) return
    setEmptying(true)
    await fetch('/api/trash/empty', { method: 'DELETE' })
    setItems([])
    setEmptying(false)
    onRestored()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trash-modal" onClick={e => e.stopPropagation()}>
        <div className="trash-header">
          <div className="trash-title">
            <span>🗑 Recently Deleted</span>
            <span className="trash-sub">Photos are permanently deleted after 7 days</span>
          </div>
          <div className="trash-header-actions">
            {items.length > 0 && (
              <button className="btn-empty-trash" onClick={emptyTrash} disabled={emptying}>
                {emptying ? '…' : 'Empty Trash'}
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="trash-body">
          {loading ? (
            <div className="trash-loading"><div className="asp-spinner"/></div>
          ) : items.length === 0 ? (
            <div className="trash-empty">
              <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>🗑</div>
              <p>Trash is empty</p>
            </div>
          ) : (
            <div className="trash-grid">
              {items.map(p => (
                <div key={p.id} className="trash-card">
                  <img src={`/api/photos/${p.id}/thumbnail`} alt={p.original_name} />
                  <div className="trash-card-info">
                    <span className="trash-name">{p.original_name}</span>
                    <span className="trash-days">{daysLeft(p.deleted_at)}d left</span>
                  </div>
                  <button className="trash-restore" onClick={() => restore(p.id)}>↩ Restore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
