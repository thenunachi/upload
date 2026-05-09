import { useState, useMemo } from 'react'
import './MemoriesBanner.css'

export default function MemoriesBanner({ photos, onViewMemories }) {
  const [dismissed, setDismiss] = useState(false)

  const memories = useMemo(() => {
    const now = new Date()
    const m = now.getMonth(), d = now.getDate(), y = now.getFullYear()
    return photos.filter(p => {
      const pd = new Date(p.uploaded_at)
      return pd.getMonth() === m && pd.getDate() === d && pd.getFullYear() < y
    })
  }, [photos])

  if (!memories.length || dismissed) return null

  const years = [...new Set(memories.map(p => new Date(p.uploaded_at).getFullYear()))].sort().reverse()
  const yearsAgo = new Date().getFullYear() - years[0]
  const thumbs = memories.slice(0, 4)

  return (
    <div className="mem-banner" onClick={() => onViewMemories(memories)}>
      <div className="mem-thumbs">
        {thumbs.map(p => (
          <img key={p.id} src={`/api/photos/${p.id}/thumbnail`} className="mem-thumb" alt="" />
        ))}
      </div>
      <div className="mem-text">
        <span className="mem-title">
          📅 {yearsAgo} year{yearsAgo !== 1 ? 's' : ''} ago today
        </span>
        <span className="mem-sub">
          {memories.length} photo{memories.length !== 1 ? 's' : ''} — tap to view
        </span>
      </div>
      <button className="mem-close" onClick={e => { e.stopPropagation(); setDismiss(true) }}>✕</button>
    </div>
  )
}
