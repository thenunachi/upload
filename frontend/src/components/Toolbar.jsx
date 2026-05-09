import './Toolbar.css'

const SORTS = [
  { value: 'shuffle', label: '🔀 Shuffle' },
  { value: 'newest',  label: '🕐 Newest'  },
  { value: 'oldest',  label: '🕰 Oldest'  },
  { value: 'largest', label: '📦 Largest' },
  { value: 'smallest',label: '🪶 Smallest'},
]

export default function Toolbar({
  searchQuery, setSearchQuery,
  sortBy, setSortBy,
  showFavOnly, setShowFavOnly,
  bulkMode, setBulkMode,
  activeAlbum, clearAlbum,
  onOpenAlbums,
  selectedCount,
  onOpenTrash,
  trashCount,
  onRandom,
  allTags, activeTag, setActiveTag,
}) {
  return (
    <div className="toolbar">
      {/* Album breadcrumb */}
      {activeAlbum && (
        <button className="tb-album-crumb" onClick={clearAlbum}>
          ← {activeAlbum.name}
        </button>
      )}

      {/* Search */}
      <div className="tb-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search photos…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="tb-search-input"
        />
        {searchQuery && (
          <button className="tb-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {/* Sort */}
      <select className="tb-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
        {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Favorites filter */}
      <button
        className={`tb-btn ${showFavOnly ? 'active' : ''}`}
        onClick={() => setShowFavOnly(v => !v)}
        title="Show favorites only"
      >
        {showFavOnly ? '❤️' : '🤍'} Favorites
      </button>

      {/* Bulk select */}
      <button
        className={`tb-btn ${bulkMode ? 'active' : ''}`}
        onClick={() => setBulkMode(v => !v)}
        title="Select photos"
      >
        {bulkMode ? `☑ ${selectedCount}` : '☐ Select'}
      </button>

      {/* Albums */}
      <button className="tb-btn" onClick={onOpenAlbums} title="Albums">
        🗂 Albums
      </button>

      {/* Trash */}
      <button className={`tb-btn ${trashCount > 0 ? 'tb-btn-warn' : ''}`} onClick={onOpenTrash} title="Recently deleted">
        🗑{trashCount > 0 ? ` ${trashCount}` : ''}
      </button>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <select
          className="tb-sort"
          value={activeTag || ''}
          onChange={e => setActiveTag(e.target.value || null)}
          title="Filter by tag"
        >
          <option value="">🏷 All tags</option>
          {allTags.map(t => (
            <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
          ))}
        </select>
      )}

      {/* Random */}
      <button className="tb-btn" onClick={onRandom} title="Surprise me — open a random photo">
        🎲
      </button>
    </div>
  )
}
