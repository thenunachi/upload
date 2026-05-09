import { useState, useRef, useCallback, useEffect } from 'react'
import './UploadZone.css'

export default function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [pasteHint, setPasteHint] = useState(false)
  const inputRef = useRef(null)

  const upload = useCallback(async (files, fromClipboard = false) => {
    if (!files.length) return
    if (fromClipboard) setPasteHint(true)
    setUploading(true)
    setProgress({ done: 0, total: files.length })
    const BATCH = 10
    const allUploaded = [], allErrors = []

    for (let i = 0; i < files.length; i += BATCH) {
      const batch = Array.from(files).slice(i, i + BATCH)
      const form = new FormData()
      batch.forEach(f => form.append('files', f))
      try {
        const data = await fetch('/api/photos', { method: 'POST', body: form }).then(r => r.json())
        allUploaded.push(...(data.uploaded || []))
        allErrors.push(...(data.errors || []))
      } catch {
        batch.forEach(f => allErrors.push({ name: f.name, error: 'Upload failed', type: 'error' }))
      }
      setProgress({ done: Math.min(i + BATCH, files.length), total: files.length })
    }

    setUploading(false)
    setProgress(null)
    setPasteHint(false)
    onUploaded(allUploaded, allErrors)
  }, [onUploaded])

  // Ctrl+V / Cmd+V paste from clipboard
  useEffect(() => {
    const onPaste = (e) => {
      if (uploading) return
      const items = e.clipboardData?.items
      if (!items) return
      const images = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) images.push(file)
        }
      }
      if (images.length) upload(images, true)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [upload, uploading])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); upload(e.dataTransfer.files)
  }, [upload])

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div
      className={`upload-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
      onDrop={onDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple accept="image/*"
        onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }}
        style={{ display: 'none' }}
      />

      {uploading ? (
        <div className="upload-progress">
          <div className="spinner" />
          {pasteHint
            ? <p>📋 Uploading from clipboard…</p>
            : <p>Uploading {progress.done} / {progress.total}</p>
          }
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <span className="progress-pct">{pct}%</span>
        </div>
      ) : (
        <div className="upload-idle">
          <div className="upload-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
          <p className="upload-title">{dragging ? 'Drop to upload' : 'Drag photos here'}</p>
          <p className="upload-sub">or click to browse · paste with Ctrl+V · JPG PNG GIF WebP up to 50 MB</p>
        </div>
      )}
    </div>
  )
}
