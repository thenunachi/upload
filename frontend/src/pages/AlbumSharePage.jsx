import { useState, useEffect } from 'react'
import './AlbumSharePage.css'

function fmtSize(b) {
  if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1024/1024).toFixed(1)} MB`
}

export default function AlbumSharePage({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [big, setBig] = useState(null)

  useEffect(() => {
    fetch(`/api/share/album/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setError(true))
  }, [token])

  if (error) return (
    <div className="asp-error">
      <div>🔒</div><h2>Album not found</h2>
      <p>This share link may have been revoked.</p>
    </div>
  )
  if (!data) return <div className="asp-loading"><div className="asp-spinner"/><p>Loading…</p></div>

  const { album, photos } = data

  return (
    <div className="asp-root">
      <header className="asp-header">
        <span className="asp-logo">📷 PhotoVault</span>
        <div className="asp-info">
          <h1 className="asp-title">🗂 {album.name}</h1>
          <span className="asp-meta">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      <div className="asp-grid">
        {photos.map(p => (
          <div key={p.id} className="asp-card" onClick={() => setBig(p)}>
            <img src={`/api/photos/${p.id}/thumbnail`} alt={p.original_name} loading="lazy"/>
          </div>
        ))}
      </div>

      {big && (
        <div className="asp-lightbox" onClick={() => setBig(null)}>
          <div className="asp-lb-inner" onClick={e => e.stopPropagation()}>
            <button className="asp-lb-close" onClick={() => setBig(null)}>✕</button>
            <img src={`/api/photos/${big.id}/image`} alt={big.original_name}/>
            <div className="asp-lb-meta">
              <span>{big.original_name}</span>
              <span>{big.width && big.height ? `${big.width}×${big.height} · ` : ''}{fmtSize(big.size)}</span>
              <a href={`/api/photos/${big.id}/image`} download={big.original_name} onClick={e => e.stopPropagation()}>
                ⬇ Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
