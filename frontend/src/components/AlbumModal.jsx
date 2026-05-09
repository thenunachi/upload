import { useState } from 'react'
import './AlbumModal.css'

export default function AlbumModal({ albums, onClose, onCreateAlbum, onDeleteAlbum, onViewAlbum, onShareAlbum, onAddSelected, addMode }) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    await onCreateAlbum(newName.trim())
    setNewName('')
    setCreating(false)
  }

  const handleShare = async (album) => {
    const { token } = await onShareAlbum(album.id)
    const url = `${window.location.origin}/share/album/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(album.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="album-modal" onClick={e => e.stopPropagation()}>
        <div className="album-modal-header">
          <h3>{addMode ? 'Add to Album' : 'Albums'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="album-list">
          {albums.length === 0 && (
            <p className="album-empty">No albums yet — create one below.</p>
          )}
          {albums.map(album => (
            <div key={album.id} className="album-row">
              <button className="album-name-btn" onClick={() => addMode ? onAddSelected(album.id) : onViewAlbum(album)}>
                <span className="album-icon">🗂</span>
                <span className="album-label">{album.name}</span>
                <span className="album-cnt">{album.photo_count}</span>
              </button>
              {!addMode && (
                <div className="album-row-actions">
                  <button
                    className={`album-act ${copied === album.id ? 'copied' : ''}`}
                    onClick={() => handleShare(album)}
                    title="Copy share link"
                  >
                    {copied === album.id ? '✓' : '🔗'}
                  </button>
                  <button
                    className="album-act album-act-del"
                    onClick={() => onDeleteAlbum(album.id)}
                    title="Delete album"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!addMode && (
          <form className="album-create" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="New album name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="album-input"
              maxLength={60}
            />
            <button type="submit" className="album-create-btn" disabled={!newName.trim() || creating}>
              {creating ? '…' : '+ Create'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
