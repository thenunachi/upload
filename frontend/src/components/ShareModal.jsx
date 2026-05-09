import { useState } from 'react'
import './ShareModal.css'

export default function ShareModal({ photo, onClose }) {
  const [shareUrl, setShareUrl] = useState(
    photo.share_token ? `${window.location.origin}/share/${photo.share_token}` : null
  )
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/photos/${photo.id}/share`, { method: 'POST' })
      const data = await res.json()
      setShareUrl(`${window.location.origin}/share/${data.token}`)
    } finally {
      setLoading(false)
    }
  }

  const revoke = async () => {
    setRevoking(true)
    try {
      await fetch(`/api/photos/${photo.id}/share`, { method: 'DELETE' })
      setShareUrl(null)
    } finally {
      setRevoking(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <h3>Share Photo</h3>
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="share-body">
          <img
            src={`/api/photos/${photo.id}/thumbnail`}
            alt={photo.original_name}
            className="share-thumb"
          />
          <p className="share-name">{photo.original_name}</p>

          {!shareUrl ? (
            <button className="btn-share-gen" onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : '&#128279; Generate Share Link'}
            </button>
          ) : (
            <>
              <div className="share-link-row">
                <input className="share-link-input" value={shareUrl} readOnly />
                <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={copy}>
                  {copied ? '&#10003; Copied' : 'Copy'}
                </button>
              </div>
              <p className="share-note">Anyone with this link can view and download the photo.</p>
              <button className="btn-revoke" onClick={revoke} disabled={revoking}>
                {revoking ? 'Revoking…' : '&#128683; Revoke Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
