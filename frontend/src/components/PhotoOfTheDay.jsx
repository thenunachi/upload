import { useState } from 'react'
import './PhotoOfTheDay.css'

export default function PhotoOfTheDay({ photos, onOpen }) {
  const todayStr = new Date().toDateString()
  const [dismissed, setDismiss] = useState(
    () => localStorage.getItem('potd-dismissed') === todayStr
  )

  if (!photos.length || dismissed) return null

  const dayNum = Math.floor(Date.now() / 86400000)
  const photo  = photos[dayNum % photos.length]

  const dismiss = () => {
    localStorage.setItem('potd-dismissed', todayStr)
    setDismiss(true)
  }

  return (
    <div className="potd">
      <div className="potd-img-wrap" onClick={() => onOpen(photo)}>
        <img src={`/api/photos/${photo.id}/thumbnail`} alt={photo.original_name} className="potd-img" />
        <div className="potd-overlay">
          <span>View full photo</span>
        </div>
      </div>
      <div className="potd-info">
        <span className="potd-badge">📸 Photo of the Day</span>
        <p className="potd-name">{photo.original_name}</p>
        <p className="potd-date">
          {new Date(photo.uploaded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <button className="potd-close" onClick={dismiss} title="Dismiss for today">✕</button>
    </div>
  )
}
