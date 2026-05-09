import { useState, useEffect, useCallback, useMemo } from 'react'
import Gallery from './components/Gallery.jsx'
import Lightbox from './components/Lightbox.jsx'
import ShareModal from './components/ShareModal.jsx'
import EditModal from './components/EditModal.jsx'
import UploadZone from './components/UploadZone.jsx'
import Confetti from './components/Confetti.jsx'
import Toolbar from './components/Toolbar.jsx'
import BulkBar from './components/BulkBar.jsx'
import AlbumModal from './components/AlbumModal.jsx'
import CollageModal from './components/CollageModal.jsx'
import TrashModal from './components/TrashModal.jsx'
import PhotoOfTheDay from './components/PhotoOfTheDay.jsx'
import MemoriesBanner from './components/MemoriesBanner.jsx'
import SharePage from './pages/SharePage.jsx'
import AlbumSharePage from './pages/AlbumSharePage.jsx'
import { playShutter, playPop, playHeart, playSuccess, playSelect } from './utils/sounds.js'
import './App.css'

function parseRoute() {
  const p = window.location.pathname
  const album = p.match(/^\/share\/album\/([^/]+)$/)
  if (album) return { type: 'album-share', token: album[1] }
  const photo = p.match(/^\/share\/([^/]+)$/)
  if (photo) return { type: 'photo-share', token: photo[1] }
  return null
}

const THEMES = ['dark', 'dim', 'light']
const THEME_ICONS = { dark: '🌙', dim: '⭐', light: '☀️' }

export default function App() {
  const route = parseRoute()
  if (route?.type === 'album-share') return <AlbumSharePage token={route.token} />
  if (route?.type === 'photo-share') return <SharePage token={route.token} />
  return <PhotoApp />
}

function PhotoApp() {
  // ── Core data ──
  const [photos, setPhotos] = useState([])
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ count: 0, total_size: 0 })

  // ── UI state ──
  const [uploadErrors, setUploadErrors] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [theme, setThemeState] = useState(() => localStorage.getItem('pv-theme') || 'dark')

  // ── Lightbox ──
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [sharePhoto, setSharePhoto] = useState(null)
  const [editPhoto, setEditPhoto] = useState(null)

  // ── Search / Sort / Filter ──
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('shuffle')
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [activeAlbum, setActiveAlbum] = useState(null) // { id, name, photos }
  const [activeTag, setActiveTag] = useState(null)
  const [allTags, setAllTags] = useState([])

  // ── Bulk select ──
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState(new Set())

  // ── Albums modal ──
  const [showAlbums, setShowAlbums] = useState(false)
  const [albumAddMode, setAlbumAddMode] = useState(false)

  // ── Collage / Trash modals ──
  const [showCollage, setShowCollage] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [trashCount, setTrashCount] = useState(0)

  // ── Data fetching ──
  const fetchPhotos = useCallback(async () => {
    try {
      const data = await fetch('/api/photos').then(r => r.json())
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]]
      }
      setPhotos(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchStats = useCallback(async () => {
    try { setStats(await fetch('/api/stats').then(r => r.json())) }
    catch { /* ignore */ }
  }, [])

  const fetchAlbums = useCallback(async () => {
    try { setAlbums(await fetch('/api/albums').then(r => r.json())) }
    catch { /* ignore */ }
  }, [])

  const fetchTrashCount = useCallback(async () => {
    try { const d = await fetch('/api/trash').then(r => r.json()); setTrashCount(d.length) }
    catch { /* ignore */ }
  }, [])

  const fetchTags = useCallback(async () => {
    try { setAllTags(await fetch('/api/tags').then(r => r.json())) }
    catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchPhotos(); fetchStats(); fetchAlbums(); fetchTrashCount(); fetchTags() }, [fetchPhotos, fetchStats, fetchAlbums, fetchTrashCount, fetchTags])

  // ── Derived display photos ──
  const displayPhotos = useMemo(() => {
    let src = activeAlbum ? activeAlbum.photos : photos
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      src = src.filter(p =>
        p.original_name.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (showFavOnly) src = src.filter(p => p.is_favorite)
    if (activeTag) src = src.filter(p => (p.tags || []).includes(activeTag))
    switch (sortBy) {
      case 'newest':  return [...src].sort((a,b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
      case 'oldest':  return [...src].sort((a,b) => new Date(a.uploaded_at) - new Date(b.uploaded_at))
      case 'largest': return [...src].sort((a,b) => b.size - a.size)
      case 'smallest':return [...src].sort((a,b) => a.size - b.size)
      default: return src
    }
  }, [photos, searchQuery, showFavOnly, sortBy, activeAlbum])

  const grouped = sortBy === 'newest' || sortBy === 'oldest'

  const handleTagsChange = useCallback((photoId, newTags) => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, tags: newTags } : p))
    fetchTags()
  }, [fetchTags])

  // ── Handlers ──
  const setTheme = (t) => { setThemeState(t); localStorage.setItem('pv-theme', t) }

  const handleUploaded = useCallback((uploaded, errors) => {
    setUploadErrors(errors || [])
    setShowUpload(false)
    fetchPhotos(); fetchStats()
    if (uploaded?.length > 0) { setConfetti(true); playSuccess() }
  }, [fetchPhotos, fetchStats])

  const handleDelete = useCallback(async (id) => {
    await fetch(`/api/photos/${id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== id))
    fetchStats(); fetchTrashCount(); playPop()
    if (lightboxPhoto?.id === id) setLightboxPhoto(null)
  }, [lightboxPhoto, fetchStats, fetchTrashCount])

  const handleRandom = useCallback(() => {
    if (!photos.length) return
    const p = photos[Math.floor(Math.random() * photos.length)]
    setLightboxIndex(displayPhotos.findIndex(x => x.id === p.id) ?? 0)
    setLightboxPhoto(p); playShutter()
  }, [photos, displayPhotos])

  const handleViewMemories = useCallback((memPhotos) => {
    if (!memPhotos.length) return
    setLightboxIndex(0); setLightboxPhoto(memPhotos[0]); playShutter()
  }, [])

  const handleFavorite = useCallback(async (id) => {
    const data = await fetch(`/api/photos/${id}/favorite`, { method: 'POST' }).then(r => r.json())
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, is_favorite: data.is_favorite ? 1 : 0 } : p))
    if (lightboxPhoto?.id === id) setLightboxPhoto(prev => ({ ...prev, is_favorite: data.is_favorite ? 1 : 0 }))
    playHeart()
  }, [lightboxPhoto])

  const openLightbox = useCallback((photo) => {
    setLightboxIndex(displayPhotos.findIndex(p => p.id === photo.id))
    setLightboxPhoto(photo)
    playShutter()
  }, [displayPhotos])

  const navigateLightbox = useCallback((dir) => {
    setLightboxIndex(prev => {
      const next = (prev + dir + displayPhotos.length) % displayPhotos.length
      setLightboxPhoto(displayPhotos[next])
      return next
    })
  }, [displayPhotos])

  // Bulk
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
    playSelect()
  }, [])

  const cancelBulk = () => { setBulkMode(false); setSelected(new Set()) }

  const bulkDelete = async () => {
    await Promise.all([...selected].map(id => fetch(`/api/photos/${id}`, { method: 'DELETE' })))
    setPhotos(prev => prev.filter(p => !selected.has(p.id)))
    fetchStats(); cancelBulk(); playPop()
  }

  const bulkFavorite = async () => {
    await Promise.all([...selected].map(id => fetch(`/api/photos/${id}/favorite`, { method: 'POST' })))
    const ids = new Set(selected)
    setPhotos(prev => prev.map(p => ids.has(p.id) ? { ...p, is_favorite: 1 } : p))
    cancelBulk(); playHeart()
  }

  // Albums
  const handleCreateAlbum = async (name) => {
    const data = await fetch('/api/albums', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(r => r.json())
    fetchAlbums(); return data
  }

  const handleDeleteAlbum = async (id) => {
    await fetch(`/api/albums/${id}`, { method: 'DELETE' })
    fetchAlbums()
    if (activeAlbum?.id === id) setActiveAlbum(null)
  }

  const handleViewAlbum = async (album) => {
    const albumPhotos = await fetch(`/api/albums/${album.id}/photos`).then(r => r.json())
    setActiveAlbum({ ...album, photos: albumPhotos })
    setShowAlbums(false)
  }

  const handleShareAlbum = async (albumId) => {
    return await fetch(`/api/albums/${albumId}/share`, { method: 'POST' }).then(r => r.json())
  }

  const handleAddToAlbum = async (albumId) => {
    await fetch(`/api/albums/${albumId}/photos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: [...selected] })
    })
    fetchAlbums(); cancelBulk(); setShowAlbums(false); setAlbumAddMode(false)
  }

  function fmtSize(b) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="app" data-theme={theme}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-right">
          {stats.count > 0 && (
            <span className="navbar-stat">
              <strong>{stats.count}</strong> photos · <strong>{fmtSize(stats.total_size)}</strong>
            </span>
          )}
          <div className="theme-switcher">
            {THEMES.map(t => (
              <button key={t} className={`theme-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)} title={t}>
                {THEME_ICONS[t]}
              </button>
            ))}
          </div>
          <button className="btn-upload-nav" onClick={() => setShowUpload(v => !v)}>
            + Upload
          </button>
        </div>
      </nav>

      {/* Toolbar */}
      <Toolbar
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortBy={sortBy} setSortBy={setSortBy}
        showFavOnly={showFavOnly} setShowFavOnly={setShowFavOnly}
        bulkMode={bulkMode} setBulkMode={v => { setBulkMode(v); if (!v) setSelected(new Set()) }}
        activeAlbum={activeAlbum} clearAlbum={() => setActiveAlbum(null)}
        onOpenAlbums={() => { setAlbumAddMode(false); setShowAlbums(true) }}
        selectedCount={selected.size}
        onOpenTrash={() => setShowTrash(true)}
        trashCount={trashCount}
        onRandom={handleRandom}
        allTags={allTags} activeTag={activeTag} setActiveTag={setActiveTag}
      />

      <div className="main-content">
        <PhotoOfTheDay photos={photos} onOpen={openLightbox} />
        <MemoriesBanner photos={photos} onViewMemories={handleViewMemories} />

        {showUpload && <div className="upload-banner"><UploadZone onUploaded={handleUploaded} /></div>}

        {uploadErrors.length > 0 && (
          <div className="error-list">
            {uploadErrors.map((e, i) => (
              <div key={i} className={`error-item ${e.type === 'duplicate' ? 'error-dup' : ''}`}>
                {e.type === 'duplicate' ? '⚠️' : '❌'} <strong>{e.name}</strong>: {e.error}
              </div>
            ))}
          </div>
        )}

        {loading ? <div className="loading">Loading…</div> : (
          <Gallery
            photos={displayPhotos}
            onOpen={openLightbox}
            onDelete={handleDelete}
            onFavorite={handleFavorite}
            bulkMode={bulkMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            grouped={grouped}
            showUpload={!showUpload && photos.length === 0}
            onShowUpload={() => setShowUpload(true)}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          index={lightboxIndex}
          total={displayPhotos.length}
          onClose={() => setLightboxPhoto(null)}
          onNav={navigateLightbox}
          onDelete={handleDelete}
          onShare={() => setSharePhoto(lightboxPhoto)}
          onEdit={() => setEditPhoto(lightboxPhoto)}
          onFavorite={handleFavorite}
          onTagsChange={handleTagsChange}
        />
      )}

      {sharePhoto && <ShareModal photo={sharePhoto} onClose={() => setSharePhoto(null)} />}
      {editPhoto && <EditModal photo={editPhoto} onClose={() => setEditPhoto(null)} onSaved={() => { fetchPhotos(); fetchStats() }} />}

      {/* Albums modal */}
      {showAlbums && (
        <AlbumModal
          albums={albums}
          addMode={albumAddMode}
          onClose={() => { setShowAlbums(false); setAlbumAddMode(false) }}
          onCreateAlbum={handleCreateAlbum}
          onDeleteAlbum={handleDeleteAlbum}
          onViewAlbum={handleViewAlbum}
          onShareAlbum={handleShareAlbum}
          onAddSelected={handleAddToAlbum}
        />
      )}

      {/* Bulk action bar */}
      <BulkBar
        count={selected.size}
        selectedIds={[...selected]}
        onFavorite={bulkFavorite}
        onAddToAlbum={() => { setAlbumAddMode(true); setShowAlbums(true) }}
        onCollage={() => setShowCollage(true)}
        onDelete={bulkDelete}
        onCancel={cancelBulk}
      />

      {showTrash && (
        <TrashModal
          onClose={() => setShowTrash(false)}
          onRestored={() => { fetchPhotos(); fetchStats(); fetchTrashCount() }}
        />
      )}

      {showCollage && (
        <CollageModal
          initialIds={[...selected]}
          allPhotos={photos}
          onClose={() => setShowCollage(false)}
          onCreated={() => { fetchPhotos(); fetchStats(); cancelBulk(); setConfetti(true) }}
        />
      )}

      <Confetti active={confetti} onDone={() => setConfetti(false)} />
    </div>
  )
}
