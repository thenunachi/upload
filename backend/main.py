import base64
import hashlib
import io
import sqlite3
import uuid
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageEnhance, ExifTags
from pydantic import BaseModel

import os

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
THUMB_DIR = UPLOAD_DIR / "thumbnails"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMB_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = os.environ.get("DB_PATH", "photos.db")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"}
MAX_SIZE_MB = 50

app = FastAPI(title="Photo App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CropBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class EditRequest(BaseModel):
    crop: Optional[CropBox] = None
    rotate: int = 0
    flip_h: bool = False
    flip_v: bool = False
    brightness: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS photos (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            size INTEGER NOT NULL,
            width INTEGER,
            height INTEGER,
            uploaded_at TEXT NOT NULL,
            share_token TEXT,
            file_hash TEXT,
            parent_id TEXT,
            is_favorite INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS albums (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            share_token TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS photo_albums (
            photo_id TEXT NOT NULL,
            album_id TEXT NOT NULL,
            PRIMARY KEY (photo_id, album_id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS photo_tags (
            photo_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            PRIMARY KEY (photo_id, tag_id)
        )
    """)
    for col, typ in [
        ("share_token","TEXT"), ("file_hash","TEXT"), ("parent_id","TEXT"),
        ("is_favorite","INTEGER DEFAULT 0"), ("deleted_at","TEXT"), ("blur_data","TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE photos ADD COLUMN {col} {typ}")
        except Exception:
            pass
    conn.commit()
    conn.close()


init_db()


def make_blur_data(src_path: Path) -> str:
    with Image.open(src_path) as img:
        img.thumbnail((16, 16), Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=40)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def make_thumbnail(src_path: Path, thumb_path: Path, size=(400, 400)):
    with Image.open(src_path) as img:
        img.thumbnail(size, Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumb_path, "JPEG", quality=80)


# ── Photos ──────────────────────────────────────────────────────────────────

@app.get("/api/photos")
def list_photos():
    conn = get_db()
    # Auto-purge photos deleted more than 7 days ago
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    old = conn.execute("SELECT id, filename FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?", (cutoff,)).fetchall()
    for row in old:
        (UPLOAD_DIR / row["filename"]).unlink(missing_ok=True)
        (THUMB_DIR / f"{row['id']}.jpg").unlink(missing_ok=True)
    if old:
        conn.execute("DELETE FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?", (cutoff,))
        conn.commit()
    rows = conn.execute("""
        SELECT p.*, GROUP_CONCAT(t.name) as tag_names
        FROM photos p
        LEFT JOIN photo_tags pt ON p.id = pt.photo_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        WHERE p.deleted_at IS NULL
        GROUP BY p.id
        ORDER BY p.uploaded_at DESC
    """).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["tags"] = [x for x in (d.pop("tag_names", None) or "").split(",") if x]
        result.append(d)
    return result


@app.post("/api/photos")
async def upload_photos(files: list[UploadFile] = File(...)):
    results, errors = [], []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            errors.append({"name": file.filename, "error": "Unsupported file type"})
            continue
        content = await file.read()
        if len(content) > MAX_SIZE_MB * 1024 * 1024:
            errors.append({"name": file.filename, "error": f"Exceeds {MAX_SIZE_MB}MB", "type": "error"})
            continue
        file_hash = hashlib.md5(content).hexdigest()
        dup = get_db().execute("SELECT original_name FROM photos WHERE file_hash=?", (file_hash,)).fetchone()
        if dup:
            errors.append({"name": file.filename, "error": f"Already in your gallery as \"{dup['original_name']}\"", "type": "duplicate"})
            continue
        photo_id = str(uuid.uuid4())
        ext = Path(file.filename).suffix.lower() or ".jpg"
        saved_name = f"{photo_id}{ext}"
        dest = UPLOAD_DIR / saved_name
        dest.write_bytes(content)
        width = height = None
        blur_data = None
        try:
            with Image.open(dest) as img:
                width, height = img.size
            make_thumbnail(dest, THUMB_DIR / f"{photo_id}.jpg")
            blur_data = make_blur_data(dest)
        except Exception:
            pass
        conn = get_db()
        conn.execute(
            "INSERT INTO photos (id,filename,original_name,size,width,height,uploaded_at,file_hash,blur_data) VALUES (?,?,?,?,?,?,?,?,?)",
            (photo_id, saved_name, file.filename, len(content), width, height, datetime.utcnow().isoformat(), file_hash, blur_data)
        )
        conn.commit()
        conn.close()
        results.append({"id": photo_id, "original_name": file.filename})
    return {"uploaded": results, "errors": errors}


@app.get("/api/photos/{photo_id}/image")
def get_photo(photo_id: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Not found")
    path = UPLOAD_DIR / row["filename"]
    if not path.exists():
        raise HTTPException(404, "File missing")
    return FileResponse(path)


@app.get("/api/photos/{photo_id}/thumbnail")
def get_thumbnail(photo_id: str):
    thumb = THUMB_DIR / f"{photo_id}.jpg"
    if thumb.exists():
        return FileResponse(thumb)
    conn = get_db()
    row = conn.execute("SELECT filename FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    return FileResponse(UPLOAD_DIR / row["filename"])


@app.delete("/api/photos/{photo_id}")
def delete_photo(photo_id: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM photos WHERE id=?", (photo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404)
    # Soft delete — move to trash for 7 days
    conn.execute("UPDATE photos SET deleted_at=? WHERE id=?", (datetime.utcnow().isoformat(), photo_id))
    conn.commit()
    conn.close()
    return {"deleted": photo_id}


@app.get("/api/stats")
def stats():
    conn = get_db()
    row = conn.execute("SELECT COUNT(*) as count, SUM(size) as total_size FROM photos").fetchone()
    conn.close()
    return {"count": row["count"] or 0, "total_size": row["total_size"] or 0}


# ── Edit ─────────────────────────────────────────────────────────────────────

@app.post("/api/photos/{photo_id}/edit")
def edit_photo(photo_id: str, edits: EditRequest):
    conn = get_db()
    row = conn.execute("SELECT * FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    src = UPLOAD_DIR / row["filename"]
    if not src.exists():
        raise HTTPException(404, "File missing")

    with Image.open(src) as img:
        result = img.copy()
        if result.mode in ("P", "CMYK"):
            result = result.convert("RGB")

    # 1. Crop (on original coordinates)
    if edits.crop:
        w, h = result.size
        left = max(0, int(edits.crop.x * w))
        top = max(0, int(edits.crop.y * h))
        right = min(w, int((edits.crop.x + edits.crop.w) * w))
        bottom = min(h, int((edits.crop.y + edits.crop.h) * h))
        if right > left and bottom > top:
            result = result.crop((left, top, right, bottom))

    # 2. Rotate (clockwise)
    if edits.rotate % 360 != 0:
        result = result.rotate(-edits.rotate, expand=True)

    # 3. Flip
    if edits.flip_h:
        result = result.transpose(Image.FLIP_LEFT_RIGHT)
    if edits.flip_v:
        result = result.transpose(Image.FLIP_TOP_BOTTOM)

    # 4. Filters
    if edits.brightness != 1.0:
        result = ImageEnhance.Brightness(result).enhance(edits.brightness)
    if edits.contrast != 1.0:
        result = ImageEnhance.Contrast(result).enhance(edits.contrast)
    if edits.saturation != 1.0:
        result = ImageEnhance.Color(result).enhance(edits.saturation)

    new_id = str(uuid.uuid4())
    ext = Path(row["filename"]).suffix.lower() or ".jpg"
    new_filename = f"{new_id}{ext}"
    new_path = UPLOAD_DIR / new_filename

    fmt = "JPEG" if ext in (".jpg", ".jpeg") else ext.lstrip(".").upper()
    if fmt == "JPG":
        fmt = "JPEG"
    if result.mode == "RGBA" and fmt == "JPEG":
        result = result.convert("RGB")

    result.save(new_path, fmt, quality=92)
    try:
        make_thumbnail(new_path, THUMB_DIR / f"{new_id}.jpg")
    except Exception:
        pass

    width, height = result.size
    original_name = f"edited_{row['original_name']}"
    conn = get_db()
    new_hash = hashlib.md5(new_path.read_bytes()).hexdigest()
    conn.execute(
        "INSERT INTO photos (id,filename,original_name,size,width,height,uploaded_at,file_hash,parent_id) VALUES (?,?,?,?,?,?,?,?,?)",
        (new_id, new_filename, original_name, new_path.stat().st_size, width, height, datetime.utcnow().isoformat(), new_hash, photo_id)
    )
    conn.commit()
    conn.close()
    return {"id": new_id, "original_name": original_name}


# ── Share ─────────────────────────────────────────────────────────────────────

@app.post("/api/photos/{photo_id}/share")
def create_share(photo_id: str):
    conn = get_db()
    row = conn.execute("SELECT share_token FROM photos WHERE id=?", (photo_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404)
    token = row["share_token"] or str(uuid.uuid4())
    conn.execute("UPDATE photos SET share_token=? WHERE id=?", (token, photo_id))
    conn.commit()
    conn.close()
    return {"token": token}


@app.delete("/api/photos/{photo_id}/share")
def revoke_share(photo_id: str):
    conn = get_db()
    conn.execute("UPDATE photos SET share_token=NULL WHERE id=?", (photo_id,))
    conn.commit()
    conn.close()
    return {"revoked": True}


@app.get("/api/share/{token}")
def get_shared(token: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM photos WHERE share_token=?", (token,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    d = dict(row)
    d.pop("share_token", None)
    return d


@app.get("/api/share/{token}/image")
def get_shared_image(token: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM photos WHERE share_token=?", (token,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    path = UPLOAD_DIR / row["filename"]
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


@app.get("/api/share/{token}/thumbnail")
def get_shared_thumb(token: str):
    conn = get_db()
    row = conn.execute("SELECT id, filename FROM photos WHERE share_token=?", (token,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    thumb = THUMB_DIR / f"{row['id']}.jpg"
    if thumb.exists():
        return FileResponse(thumb)
    return FileResponse(UPLOAD_DIR / row["filename"])


# ── Favorites ──────────────────────────────────────────────────────────────────

@app.post("/api/photos/{photo_id}/favorite")
def toggle_favorite(photo_id: str):
    conn = get_db()
    row = conn.execute("SELECT is_favorite FROM photos WHERE id=?", (photo_id,)).fetchone()
    if not row:
        conn.close(); raise HTTPException(404)
    new_val = 0 if row["is_favorite"] else 1
    conn.execute("UPDATE photos SET is_favorite=? WHERE id=?", (new_val, photo_id))
    conn.commit(); conn.close()
    return {"is_favorite": bool(new_val)}


# ── Albums ──────────────────────────────────────────────────────────────────────

class AlbumCreate(BaseModel):
    name: str

class PhotoIds(BaseModel):
    photo_ids: list[str]


@app.get("/api/albums")
def list_albums():
    conn = get_db()
    rows = conn.execute("SELECT * FROM albums ORDER BY created_at DESC").fetchall()
    result = []
    for row in rows:
        d = dict(row)
        d["photo_count"] = conn.execute(
            "SELECT COUNT(*) as c FROM photo_albums WHERE album_id=?", (d["id"],)
        ).fetchone()["c"]
        result.append(d)
    conn.close()
    return result


@app.post("/api/albums")
def create_album(body: AlbumCreate):
    name = body.name.strip()
    if not name: raise HTTPException(400, "Name required")
    conn = get_db()
    aid = str(uuid.uuid4())
    conn.execute("INSERT INTO albums (id,name,created_at) VALUES (?,?,?)",
                 (aid, name, datetime.utcnow().isoformat()))
    conn.commit(); conn.close()
    return {"id": aid, "name": name, "photo_count": 0, "created_at": datetime.utcnow().isoformat()}


@app.delete("/api/albums/{album_id}")
def delete_album(album_id: str):
    conn = get_db()
    conn.execute("DELETE FROM albums WHERE id=?", (album_id,))
    conn.execute("DELETE FROM photo_albums WHERE album_id=?", (album_id,))
    conn.commit(); conn.close()
    return {"deleted": album_id}


@app.get("/api/albums/{album_id}/photos")
def get_album_photos(album_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT p.* FROM photos p JOIN photo_albums pa ON p.id=pa.photo_id WHERE pa.album_id=? ORDER BY p.uploaded_at DESC",
        (album_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/albums/{album_id}/photos")
def add_photos_to_album(album_id: str, body: PhotoIds):
    conn = get_db()
    for pid in body.photo_ids:
        conn.execute("INSERT OR IGNORE INTO photo_albums (photo_id,album_id) VALUES (?,?)", (pid, album_id))
    conn.commit(); conn.close()
    return {"added": len(body.photo_ids)}


@app.delete("/api/albums/{album_id}/photos/{photo_id}")
def remove_from_album(album_id: str, photo_id: str):
    conn = get_db()
    conn.execute("DELETE FROM photo_albums WHERE album_id=? AND photo_id=?", (album_id, photo_id))
    conn.commit(); conn.close()
    return {"removed": photo_id}


@app.post("/api/albums/{album_id}/share")
def share_album(album_id: str):
    conn = get_db()
    row = conn.execute("SELECT share_token FROM albums WHERE id=?", (album_id,)).fetchone()
    if not row: conn.close(); raise HTTPException(404)
    token = row["share_token"] or str(uuid.uuid4())
    conn.execute("UPDATE albums SET share_token=? WHERE id=?", (token, album_id))
    conn.commit(); conn.close()
    return {"token": token}


@app.get("/api/share/album/{token}")
def get_shared_album(token: str):
    conn = get_db()
    album = conn.execute("SELECT * FROM albums WHERE share_token=?", (token,)).fetchone()
    if not album: conn.close(); raise HTTPException(404)
    d = dict(album); d.pop("share_token", None)
    photos = conn.execute(
        "SELECT p.* FROM photos p JOIN photo_albums pa ON p.id=pa.photo_id WHERE pa.album_id=? ORDER BY p.uploaded_at DESC",
        (d["id"],)
    ).fetchall()
    conn.close()
    return {"album": d, "photos": [dict(p) for p in photos]}


# ── Watermark / Frame / Collage helpers ────────────────────────────────────────

from PIL import ImageDraw

_FONT_PATHS = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
]

def _get_font(size: int):
    from PIL import ImageFont
    for p in _FONT_PATHS:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def _apply_watermark_fn(img: Image.Image, text: str, font_size: int,
                         hex_color: str, opacity: float, position: str) -> Image.Image:
    img = img.convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = _get_font(font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    w, h = img.size
    pad = max(w, h) // 28
    r = int(hex_color[1:3], 16)
    g_c = int(hex_color[3:5], 16)
    b_c = int(hex_color[5:7], 16)
    a = int(min(max(opacity, 0), 1) * 255)
    coords = {
        "tl": (pad, pad), "tc": ((w - tw) // 2, pad), "tr": (w - tw - pad, pad),
        "ml": (pad, (h - th) // 2), "mc": ((w - tw) // 2, (h - th) // 2),
        "mr": (w - tw - pad, (h - th) // 2),
        "bl": (pad, h - th - pad), "bc": ((w - tw) // 2, h - th - pad),
        "br": (w - tw - pad, h - th - pad),
    }
    x, y = coords.get(position, coords["br"])
    draw.text((x, y), text, font=font, fill=(r, g_c, b_c, a))
    return Image.alpha_composite(img, overlay).convert("RGB")


def _apply_frame_fn(img: Image.Image, style: str) -> Image.Image:
    s = max(img.width, img.height)
    b = max(s // 20, 10)
    if style == "white":
        c = Image.new("RGB", (img.width + b*2, img.height + b*2), (255, 255, 255))
        c.paste(img, (b, b)); return c
    elif style == "thick_white":
        b2 = b * 2
        c = Image.new("RGB", (img.width + b2*2, img.height + b2*2), (255, 255, 255))
        c.paste(img, (b2, b2)); return c
    elif style == "black":
        c = Image.new("RGB", (img.width + b*2, img.height + b*2), (12, 12, 12))
        c.paste(img, (b, b)); return c
    elif style == "polaroid":
        bot = b * 4
        c = Image.new("RGB", (img.width + b*2, img.height + b + bot), (255, 255, 255))
        c.paste(img, (b, b)); return c
    elif style == "shadow":
        c = Image.new("RGB", (img.width + b*2, img.height + b*2), (26, 26, 26))
        c.paste(img, (b, b)); return c
    elif style == "film":
        c = Image.new("RGB", (img.width + b*2, img.height + b*2), (8, 8, 8))
        c.paste(img, (b, b))
        draw = ImageDraw.Draw(c)
        hr = max(b // 4, 4)
        sp = hr * 4
        for cy in range(sp, c.height - sp // 2, sp):
            for cx in [b // 2, img.width + b + b // 2]:
                draw.ellipse([cx-hr, cy-hr, cx+hr, cy+hr], fill=(200, 180, 130))
        return c
    elif style == "vintage":
        c = Image.new("RGB", (img.width + b*2, img.height + b*2), (190, 160, 100))
        c.paste(img, (b, b)); return c
    return img


def _fill_cell(img: Image.Image, width: int, height: int) -> Image.Image:
    sr = img.width / img.height; dr = width / height
    if sr > dr:
        nw, nh = int(img.width * height / img.height), height
    else:
        nw, nh = width, int(img.height * width / img.width)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - width) // 2; top = (nh - height) // 2
    return img.crop((left, top, left + width, top + height))


def _create_collage_fn(imgs: list, layout: str, gap: int, bg: tuple) -> Image.Image:
    B = 1200
    if layout == "2h":
        cw = (B - gap) // 2; ch = B // 2
        c = Image.new("RGB", (B, ch), bg)
        c.paste(_fill_cell(imgs[0], cw, ch), (0, 0))
        c.paste(_fill_cell(imgs[1], cw, ch), (cw + gap, 0))
    elif layout == "2v":
        cw = B // 2; ch = (B // 2 - gap) // 2
        c = Image.new("RGB", (cw, B // 2), bg)
        c.paste(_fill_cell(imgs[0], cw, ch), (0, 0))
        c.paste(_fill_cell(imgs[1], cw, ch), (0, ch + gap))
    elif layout == "3l":
        H = B * 2 // 3; lw = (B - gap) * 2 // 3; rw = B - lw - gap; rh = (H - gap) // 2
        c = Image.new("RGB", (B, H), bg)
        c.paste(_fill_cell(imgs[0], lw, H), (0, 0))
        c.paste(_fill_cell(imgs[1], rw, rh), (lw + gap, 0))
        c.paste(_fill_cell(imgs[2], rw, rh), (lw + gap, rh + gap))
    elif layout == "3r":
        H = B * 2 // 3; rw = (B - gap) * 2 // 3; lw = B - rw - gap; rh = (H - gap) // 2
        c = Image.new("RGB", (B, H), bg)
        c.paste(_fill_cell(imgs[0], lw, rh), (0, 0))
        c.paste(_fill_cell(imgs[1], lw, rh), (0, rh + gap))
        c.paste(_fill_cell(imgs[2], rw, H), (lw + gap, 0))
    elif layout == "4":
        cw = (B - gap) // 2; ch = (B - gap) // 2
        c = Image.new("RGB", (B, B), bg)
        for i, (px, py) in enumerate([(0,0),(cw+gap,0),(0,ch+gap),(cw+gap,ch+gap)]):
            if i < len(imgs): c.paste(_fill_cell(imgs[i], cw, ch), (px, py))
    else:
        c = Image.new("RGB", (B, B), bg)
        c.paste(_fill_cell(imgs[0], B, B), (0, 0))
    return c


def _save_as_photo(result: Image.Image, original_name: str, parent_id: Optional[str] = None) -> dict:
    new_id = str(uuid.uuid4())
    new_filename = f"{new_id}.jpg"
    new_path = UPLOAD_DIR / new_filename
    if result.mode == "RGBA":
        result = result.convert("RGB")
    result.save(new_path, "JPEG", quality=92)
    try:
        make_thumbnail(new_path, THUMB_DIR / f"{new_id}.jpg")
    except Exception:
        pass
    w, h = result.size
    new_hash = hashlib.md5(new_path.read_bytes()).hexdigest()
    conn = get_db()
    conn.execute(
        "INSERT INTO photos (id,filename,original_name,size,width,height,uploaded_at,file_hash,parent_id) VALUES (?,?,?,?,?,?,?,?,?)",
        (new_id, new_filename, original_name, new_path.stat().st_size, w, h, datetime.utcnow().isoformat(), new_hash, parent_id)
    )
    conn.commit(); conn.close()
    return {"id": new_id, "original_name": original_name}


# ── Watermark endpoint ─────────────────────────────────────────────────────────

class WatermarkRequest(BaseModel):
    text: str
    font_size: int = 48
    color: str = "#ffffff"
    opacity: float = 0.80
    position: str = "br"


@app.post("/api/photos/{photo_id}/watermark")
def apply_watermark_endpoint(photo_id: str, req: WatermarkRequest):
    conn = get_db()
    row = conn.execute("SELECT * FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404)
    src = UPLOAD_DIR / row["filename"]
    with Image.open(src) as img:
        result = _apply_watermark_fn(img.copy(), req.text, req.font_size, req.color, req.opacity, req.position)
    name = f"watermarked_{row['original_name']}"
    return _save_as_photo(result, name, photo_id)


# ── Frame endpoint ─────────────────────────────────────────────────────────────

class FrameRequest(BaseModel):
    style: str = "white"


@app.post("/api/photos/{photo_id}/frame")
def apply_frame_endpoint(photo_id: str, req: FrameRequest):
    conn = get_db()
    row = conn.execute("SELECT * FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404)
    src = UPLOAD_DIR / row["filename"]
    with Image.open(src) as img:
        result = _apply_frame_fn(img.copy(), req.style)
    name = f"{req.style}_{row['original_name']}"
    return _save_as_photo(result, name, photo_id)


# ── Collage endpoint ───────────────────────────────────────────────────────────

class CollageRequest(BaseModel):
    photo_ids: list[str]
    layout: str = "2h"
    gap: int = 6
    bg: str = "#ffffff"


@app.post("/api/collage")
def create_collage_endpoint(req: CollageRequest):
    if len(req.photo_ids) < 2: raise HTTPException(400, "Need at least 2 photos")
    if len(req.photo_ids) > 4: raise HTTPException(400, "Maximum 4 photos")
    imgs = []
    conn = get_db()
    for pid in req.photo_ids:
        row = conn.execute("SELECT filename FROM photos WHERE id=?", (pid,)).fetchone()
        if not row: conn.close(); raise HTTPException(404, f"Photo {pid} not found")
        imgs.append(Image.open(UPLOAD_DIR / row["filename"]).copy())
    conn.close()
    r = int(req.bg[1:3], 16); g_c = int(req.bg[3:5], 16); b_c = int(req.bg[5:7], 16)
    result = _create_collage_fn(imgs, req.layout, req.gap, (r, g_c, b_c))
    return _save_as_photo(result, f"collage_{len(req.photo_ids)}photos.jpg")


# ── Trash ──────────────────────────────────────────────────────────────────────

@app.get("/api/trash")
def list_trash():
    conn = get_db()
    rows = conn.execute("SELECT * FROM photos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/photos/{photo_id}/restore")
def restore_photo(photo_id: str):
    conn = get_db()
    conn.execute("UPDATE photos SET deleted_at=NULL WHERE id=?", (photo_id,))
    conn.commit(); conn.close()
    return {"restored": photo_id}

@app.delete("/api/trash/empty")
def empty_trash():
    conn = get_db()
    rows = conn.execute("SELECT id, filename FROM photos WHERE deleted_at IS NOT NULL").fetchall()
    for row in rows:
        (UPLOAD_DIR / row["filename"]).unlink(missing_ok=True)
        (THUMB_DIR / f"{row['id']}.jpg").unlink(missing_ok=True)
    conn.execute("DELETE FROM photos WHERE deleted_at IS NOT NULL")
    conn.commit(); conn.close()
    return {"emptied": len(rows)}


# ── EXIF ───────────────────────────────────────────────────────────────────────

def _read_exif(path: Path) -> dict:
    try:
        with Image.open(path) as img:
            raw = img.getexif()
            if not raw:
                return {}
        result = {}
        TAGS = ExifTags.TAGS
        GPS_TAGS = ExifTags.GPSTAGS
        for tag_id, value in raw.items():
            tag = TAGS.get(tag_id, "")
            if tag == "Make":
                result["make"] = str(value).strip()
            elif tag == "Model":
                result["model"] = str(value).strip()
            elif tag == "DateTimeOriginal":
                result["date_taken"] = str(value)
            elif tag == "ExposureTime":
                try:
                    f = float(value)
                    result["shutter"] = f"1/{round(1/f)}s" if f < 1 else f"{f:.1f}s"
                except Exception:
                    result["shutter"] = str(value)
            elif tag == "FNumber":
                try:
                    result["aperture"] = f"f/{float(value):.1f}"
                except Exception:
                    result["aperture"] = str(value)
            elif tag == "ISOSpeedRatings":
                result["iso"] = f"ISO {value}"
            elif tag == "FocalLength":
                try:
                    result["focal_length"] = f"{float(value):.0f}mm"
                except Exception:
                    result["focal_length"] = str(value)
            elif tag == "Flash":
                result["flash"] = "On" if value and int(value) & 1 else "Off"
            elif tag == "GPSInfo":
                try:
                    gps = {GPS_TAGS.get(k, k): v for k, v in value.items()}
                    def dms(coords, ref):
                        d, m, s = [float(x) for x in coords]
                        dd = d + m / 60 + s / 3600
                        return -dd if ref in ("S", "W") else dd
                    if "GPSLatitude" in gps and "GPSLongitude" in gps:
                        result["gps"] = {
                            "lat": round(dms(gps["GPSLatitude"], gps.get("GPSLatitudeRef","N")), 6),
                            "lng": round(dms(gps["GPSLongitude"], gps.get("GPSLongitudeRef","E")), 6),
                        }
                except Exception:
                    pass
        return result
    except Exception:
        return {}


@app.get("/api/photos/{photo_id}/exif")
def get_exif(photo_id: str):
    conn = get_db()
    row = conn.execute("SELECT filename FROM photos WHERE id=?", (photo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    return _read_exif(UPLOAD_DIR / row["filename"])


# ── Tags ───────────────────────────────────────────────────────────────────────

class TagBody(BaseModel):
    name: str


@app.get("/api/tags")
def list_tags():
    conn = get_db()
    rows = conn.execute("""
        SELECT t.name, COUNT(pt.photo_id) as count
        FROM tags t LEFT JOIN photo_tags pt ON t.id = pt.tag_id
        GROUP BY t.id ORDER BY t.name
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/photos/{photo_id}/tags")
def add_tag(photo_id: str, body: TagBody):
    name = body.name.strip().lower()
    if not name:
        raise HTTPException(400, "Tag name required")
    conn = get_db()
    row = conn.execute("SELECT id FROM tags WHERE name=?", (name,)).fetchone()
    if row:
        tag_id = row["id"]
    else:
        tag_id = str(uuid.uuid4())
        conn.execute("INSERT INTO tags (id, name) VALUES (?,?)", (tag_id, name))
    conn.execute("INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?,?)", (photo_id, tag_id))
    conn.commit(); conn.close()
    return {"tag": name}


@app.delete("/api/photos/{photo_id}/tags/{tag_name}")
def remove_tag(photo_id: str, tag_name: str):
    conn = get_db()
    row = conn.execute("SELECT id FROM tags WHERE name=?", (tag_name.lower(),)).fetchone()
    if row:
        conn.execute("DELETE FROM photo_tags WHERE photo_id=? AND tag_id=?", (photo_id, row["id"]))
        conn.commit()
    conn.close()
    return {"removed": tag_name}


# ── Zip download ────────────────────────────────────────────────────────────────

@app.post("/api/zip")
def download_zip(body: PhotoIds):
    if not body.photo_ids:
        raise HTTPException(400, "No photos selected")
    conn = get_db()
    files = []
    for pid in body.photo_ids:
        row = conn.execute("SELECT filename, original_name FROM photos WHERE id=?", (pid,)).fetchone()
        if row:
            path = UPLOAD_DIR / row["filename"]
            if path.exists():
                files.append((path, row["original_name"]))
    conn.close()
    if not files:
        raise HTTPException(404, "No files found")

    buf = io.BytesIO()
    seen_names: dict = {}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, name in files:
            if name in seen_names:
                seen_names[name] += 1
                stem = Path(name).stem
                suffix = Path(name).suffix
                name = f"{stem}_{seen_names[name]}{suffix}"
            else:
                seen_names[name] = 0
            zf.write(path, name)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=photos.zip"},
    )


# ── Serve React frontend (production) ─────────────────────────────────────────

_frontend = Path(__file__).parent.parent / "frontend" / "dist"
if _frontend.exists():
    app.mount("/assets", StaticFiles(directory=_frontend / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        return HTMLResponse((_frontend / "index.html").read_text())
