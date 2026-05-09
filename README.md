# PhotoVault

A full-featured personal photo gallery app built with React and Python. No external APIs or cloud services — everything runs locally on your machine.

![PhotoVault](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react) ![Python](https://img.shields.io/badge/Python-3.9+-3776ab?style=flat-square&logo=python) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square) ![SQLite](https://img.shields.io/badge/SQLite-local-003b57?style=flat-square)

---

## Features

### Upload
- **Drag & drop** or click to browse — upload hundreds of photos at once
- **Ctrl+V paste** — paste any image directly from clipboard
- **Batch upload** in groups of 10 with a live progress bar
- **Duplicate detection** — MD5 hash check prevents uploading the same file twice
- **Confetti burst** on successful upload

### Gallery
- **3-column Instagram Explore-style grid** — every 5th photo is a tall 2-row tile, alternating left and right
- **Infinite scroll** — renders 30 photos at a time, loads more as you scroll (performant at 500+ photos)
- **Progressive loading** — blurred 16×16 placeholder shown while thumbnails load
- **Shuffle on reload** — grid order randomises on every page load
- **White background** — clean, minimal look

### Search, Sort & Filter
- **Live search** — filter by filename or tag instantly as you type
- **"Image not found" state** — animated dancing illustration shown when search returns no results
- **Sort** — Shuffle, Newest, Oldest, Largest, Smallest
- **Date grouping** — Newest/Oldest views group photos under "Month Year" headers
- **Favorites filter** — show only hearted photos
- **Tag filter** — filter gallery by any tag from the toolbar dropdown

### Viewing
- **Lightbox** — fixed-size full-resolution photo viewer with an info panel on the right (consistent size across all photos)
- **Keyboard navigation** — ← → arrow keys, Esc to close, Space to play/pause slideshow
- **Slideshow** — auto-advance with 2 / 4 / 6 / 10 second intervals and a progress bar
- **Before/After slider** — drag a handle to compare original vs edited photos side by side
- **Zoom** — scroll wheel or pinch to zoom up to 6×, drag to pan, double-click to reset

### EXIF & Metadata
- **EXIF viewer** — click "Camera info" in the lightbox to see Make, Model, Date Taken, Shutter Speed, Aperture, ISO, Focal Length, Flash, GPS coordinates
- Reads directly from the image file — no external service needed

### Tags
- **Add tags** — type a tag in the lightbox and press Enter to save
- **Autocomplete** — suggestions from existing tags across your library
- **Tag filter** — a dropdown appears in the toolbar once you have tags
- **Search by tag** — searching "pig" finds photos tagged "pig" even if the filename is IMG_1234.jpg

### Editing
All edits are non-destructive — they create a new photo, leaving the original untouched.

| Tab | What it does |
|-----|-------------|
| **Crop** | Drag to draw a crop rectangle |
| **Transform** | Rotate 90°/180°, flip horizontal/vertical |
| **Filters** | Brightness, contrast, saturation sliders (live CSS preview) |
| **Frame** | White, Thick, Black, Polaroid, Shadow, Film, Vintage borders |
| **Watermark** | Custom text, font size, color, opacity, 9-position grid |
| **Stickers** | 20 emoji stickers — drag to position, canvas-rendered on save |
| **Compare** | Split-screen before/after of all current edits before saving |

### Organisation
- **Favorites** — heart any photo; shows ❤️ persistently on the card
- **Albums** — create named collections, add photos, share via link
- **Bulk select** — checkbox mode to favorite, add to album, delete, or create a collage from 2–4 photos
- **Collage maker** — combine 2–4 photos into one image with 5 layout options (side by side, stacked, large left, large right, 2×2 grid)

### Sharing
- **Photo share link** — generate a unique URL for any photo; anyone can view and download it
- **Album share link** — share an entire album publicly
- **Revoke** — remove any share link at any time

### Export
- **ZIP download** — select photos with bulk mode and download them all as a single `.zip` file
- **Single photo download** — download button in the lightbox for any photo

### Discovery
- **Photo of the Day** — a deterministic daily spotlight photo at the top of the gallery (same photo all day, dismissible)
- **Memories** — "On this day X years ago" banner when photos exist from today's date in a past year
- **🎲 Surprise Me** — opens a random photo from your gallery instantly

### Trash
- **Soft delete** — deleted photos go to trash, not permanently removed
- **7-day recovery** — restore any photo within 7 days of deletion
- **Auto-purge** — photos older than 7 days in trash are deleted permanently on next gallery load
- **Empty trash** — permanently delete everything in trash at once

### Themes & UI
- **3 themes** — 🌙 Dark (pure black), ⭐ Dim (warm gray), ☀️ Light (white) — persisted across sessions
- **Sound effects** — shutter click, delete pop, favorite chime, upload success arpeggio (Web Audio API, no files)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Backend | FastAPI 0.115, Python 3.9+ |
| Database | SQLite (single file, zero config) |
| Image processing | Pillow 11 |
| Styling | Plain CSS with custom properties (no CSS framework) |
| Audio | Web Audio API (synthesised, no audio files) |

---

## Getting Started

### Prerequisites
- Python 3.9 or later
- Node.js 18 or later

### Installation

```bash
# 1. Clone / download the project
cd Photos

# 2. Install backend dependencies
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cd ..

# 3. Install frontend dependencies
cd frontend
npm install
cd ..
```

### Running

```bash
# Start both servers with the convenience script
./start.sh
```

Then open **http://localhost:3000** in your browser.

Or start them separately:

```bash
# Terminal 1 — backend (port 8000)
cd backend
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — frontend (port 3000)
cd frontend
npm run dev
```

---

## Project Structure

```
Photos/
├── start.sh                          # Convenience script to start both servers
│
├── backend/
│   ├── main.py                       # FastAPI app — all endpoints
│   ├── requirements.txt
│   ├── photos.db                     # SQLite database (auto-created)
│   └── uploads/
│       ├── *.jpg / *.png / …         # Original photo files
│       └── thumbnails/               # 400×400 JPEG thumbnails
│
└── frontend/
    ├── vite.config.js                # Proxies /api → localhost:8000
    └── src/
        ├── App.jsx                   # Root component, all global state
        ├── utils/
        │   └── sounds.js             # Web Audio API synthesiser
        ├── gallery/
        │   ├── notFound.png          # Original not-found illustration
        │   └── notFoundCut.png       # Background-removed version (used in UI)
        ├── components/
        │   ├── Gallery.jsx/css       # Instagram grid, infinite scroll, not-found state
        │   ├── Lightbox.jsx/css      # Full-screen photo viewer with zoom, EXIF, tags
        │   ├── EditModal.jsx/css     # 7-tab photo editor
        │   ├── Toolbar.jsx/css       # Search, sort, filter, tag filter bar
        │   ├── BulkBar.jsx/css       # Floating bulk-action bar (incl. ZIP download)
        │   ├── AlbumModal.jsx/css    # Album management
        │   ├── CollageModal.jsx/css  # Collage builder
        │   ├── ShareModal.jsx/css    # Share link generator
        │   ├── TrashModal.jsx/css    # Recently deleted
        │   ├── BeforeAfter.jsx/css   # Split-screen compare slider
        │   ├── PhotoOfTheDay.jsx/css # Daily spotlight banner
        │   ├── MemoriesBanner.jsx/css# "On this day" banner
        │   ├── Confetti.jsx          # Canvas confetti burst
        │   └── UploadZone.jsx/css    # Drag-drop + paste uploader
        └── pages/
            ├── SharePage.jsx/css     # Public single-photo view
            └── AlbumSharePage.jsx/css# Public album view
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/photos` | List all photos with tags (excludes deleted) |
| POST | `/api/photos` | Upload one or more photos |
| DELETE | `/api/photos/:id` | Soft-delete a photo (moves to trash) |
| POST | `/api/photos/:id/favorite` | Toggle favorite |
| POST | `/api/photos/:id/share` | Generate share token |
| DELETE | `/api/photos/:id/share` | Revoke share token |
| POST | `/api/photos/:id/edit` | Apply crop/rotate/flip/filters |
| POST | `/api/photos/:id/frame` | Apply a decorative frame |
| POST | `/api/photos/:id/watermark` | Stamp text watermark |
| POST | `/api/photos/:id/restore` | Restore from trash |
| GET | `/api/photos/:id/image` | Serve full-size image |
| GET | `/api/photos/:id/thumbnail` | Serve 400px thumbnail |
| GET | `/api/photos/:id/exif` | Read EXIF metadata from image file |
| POST | `/api/photos/:id/tags` | Add a tag to a photo |
| DELETE | `/api/photos/:id/tags/:name` | Remove a tag from a photo |
| GET | `/api/stats` | Photo count and total size |
| GET | `/api/tags` | List all tags with photo counts |
| POST | `/api/zip` | Download selected photos as a ZIP file |
| GET | `/api/trash` | List trashed photos |
| DELETE | `/api/trash/empty` | Permanently delete all trash |
| GET | `/api/albums` | List albums |
| POST | `/api/albums` | Create album |
| DELETE | `/api/albums/:id` | Delete album |
| GET | `/api/albums/:id/photos` | Photos in an album |
| POST | `/api/albums/:id/photos` | Add photos to album |
| POST | `/api/albums/:id/share` | Generate album share token |
| POST | `/api/collage` | Create collage from 2–4 photos |
| GET | `/api/share/:token` | Public photo by share token |
| GET | `/api/share/:token/image` | Serve shared photo |
| GET | `/api/share/album/:token` | Public album by share token |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate photos in lightbox (disabled while zoomed) |
| `Space` | Play / pause slideshow |
| `Esc` | Close lightbox or modal |
| `Ctrl+V` | Paste image from clipboard |
| Scroll wheel | Zoom in / out in lightbox |
| Double-click | Reset zoom in lightbox |

---

## Data Storage

All data is local:

- **Photos** are stored as original files in `backend/uploads/`
- **Thumbnails** (400×400 JPEG) are in `backend/uploads/thumbnails/`
- **Metadata** (filenames, dimensions, favorites, albums, tags, share tokens, trash) is in `backend/photos.db` — a single SQLite file
- **No cloud, no accounts, no telemetry**

To back up everything: copy the `backend/uploads/` folder and `backend/photos.db`.

---

## Limits

| Item | Default |
|------|---------|
| Max file size | 50 MB per photo |
| Supported formats | JPEG, PNG, GIF, WebP, BMP, TIFF |
| Collage photos | 2–4 |
| Watermark text | 80 characters |
| Trash retention | 7 days |
| Lightbox zoom | 6× |
# upload
