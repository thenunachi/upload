import { useState, useEffect } from 'react'
import './SharePage.css'

function fmtSize(b) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function SharePage({ token }) {
  const [photo, setPhoto] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setPhoto)
      .catch(() => setError(true))
  }, [token])

  if (error) {
    return (
      <div className="sp-error">
        <div className="sp-error-icon">&#128683;</div>
        <h2>Link not found</h2>
        <p>This share link may have been revoked or never existed.</p>
      </div>
    )
  }

  if (!photo) {
    return (
      <div className="sp-loading">
        <div className="sp-spinner" />
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="sp-root">
      <header className="sp-header">
        <span className="sp-logo">&#128247; PhotoVault</span>
      </header>
      <main className="sp-main">
        <img
          src={`/api/share/${token}/image`}
          alt={photo.original_name}
          className="sp-img"
        />
        <div className="sp-info">
          <h2 className="sp-name">{photo.original_name}</h2>
          <p className="sp-meta">
            {photo.width && photo.height && `${photo.width} × ${photo.height} px · `}
            {fmtSize(photo.size)}
          </p>
          <a
            className="sp-download"
            href={`/api/share/${token}/image`}
            download={photo.original_name}
          >
            &#8681; Download
          </a>
        </div>
      </main>
    </div>
  )
}
