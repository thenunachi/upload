import { useState, useRef } from 'react'
import './BeforeAfter.css'

/**
 * Split-screen before/after slider.
 *
 * Props (two modes):
 *  URL mode:  beforeSrc + afterSrc          — compare two different images
 *  CSS mode:  beforeSrc + afterStyle        — same image, different CSS applied
 */
export default function BeforeAfter({ beforeSrc, afterSrc, afterStyle = {} }) {
  const [pos, setPos] = useState(50)          // % from left
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)
  const handleRef = useRef(null)

  const calcPos = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect()
    return Math.max(2, Math.min(98, (clientX - rect.left) / rect.width * 100))
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    setDragging(true)
    handleRef.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging) return
    setPos(calcPos(e.clientX))
  }

  const onPointerUp = () => setDragging(false)

  const imgSrc = afterSrc || beforeSrc

  return (
    <div
      className="ba-root"
      ref={containerRef}
      style={{ cursor: dragging ? 'ew-resize' : 'default' }}
    >
      {/* Before — always full width underneath */}
      <img src={beforeSrc} className="ba-img ba-before" draggable={false} alt="Before" />

      {/* After — clipped to right portion */}
      <div className="ba-after-wrap" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img
          src={imgSrc}
          className="ba-img ba-after"
          style={afterStyle}
          draggable={false}
          alt="After"
        />
      </div>

      {/* Divider + handle */}
      <div className="ba-divider" style={{ left: `${pos}%` }}>
        <div
          ref={handleRef}
          className="ba-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <polyline points="15 18 21 12 15 6"/>
            <polyline points="9 6 3 12 9 18"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="ba-label ba-label-l">Before</span>
      <span className="ba-label ba-label-r">After</span>
    </div>
  )
}
