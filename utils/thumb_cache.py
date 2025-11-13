import os
import hashlib
from typing import Tuple, Optional

try:
    from PIL import Image
except Exception:
    Image = None

try:
    import tifffile as _tifffile
except Exception:
    _tifffile = None

_heif_registered = False
try:
    import pillow_heif as _pillow_heif
except Exception:
    _pillow_heif = None

def _sha1(text: str) -> str:
    h = hashlib.sha1()
    h.update(text.encode("utf-8", errors="ignore"))
    return h.hexdigest()

def cache_dir() -> str:
    base = os.getenv("LOCALAPPDATA") or os.path.expanduser("~")
    d = os.path.join(base, "photo_viewer_cache")
    os.makedirs(d, exist_ok=True)
    return d

def thumb_path(path: str, size: Optional[Tuple[int, int]] = None) -> str:
    base = _sha1(os.path.abspath(path))
    if size:
        name = f"{base}_{int(size[0])}x{int(size[1])}.png"
    else:
        name = base + ".png"
    return os.path.join(cache_dir(), name)

def bucket_size(size: Tuple[int, int]) -> Tuple[int, int]:
    w, h = size
    buckets = [256, 384, 512]
    target = max(64, int(w))
    bw = buckets[0]
    for b in buckets:
        if b >= target:
            bw = b
            break
        bw = b
    bh = max(64, int(h))
    ratio = bh / max(1, target)
    return (bw, int(bw * ratio))

def _read_image(path: str) -> Image.Image:
    if Image is None:
        raise RuntimeError("Pillow未安装")
    global _heif_registered
    if not _heif_registered and _pillow_heif is not None:
        try:
            _pillow_heif.register_heif_opener()
            _heif_registered = True
        except Exception:
            pass
    try:
        return Image.open(path)
    except Exception:
        if _tifffile is not None and path.lower().endswith((".tif", ".tiff")):
            with _tifffile.TiffFile(path) as tf:
                arr = tf.pages[0].asarray()
                return Image.fromarray(arr)
        raise

_PLACEHOLDER_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0cIDAT\x08\xd7c\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\x89\x0f\xa7\x00\x00\x00\x00IEND\xaeB`\x82"
)

def build_thumb(path: str, size: Tuple[int, int] = (160, 160)) -> str:
    out = thumb_path(path, size)
    try:
        img = _read_image(path)
        try:
            img.thumbnail(size, resample=Image.LANCZOS)
        except Exception:
            img.thumbnail(size)
        tmp = out + ".tmp"
        img.save(tmp, format="PNG")
        try:
            os.replace(tmp, out)
        except Exception:
            # fallback copy
            try:
                if os.path.exists(tmp):
                    with open(tmp, "rb") as rf, open(out, "wb") as wf:
                        wf.write(rf.read())
                    os.remove(tmp)
            except Exception:
                pass
    except Exception:
        # 写入有效占位PNG，避免加载失败与日志刷屏
        try:
            if Image is not None:
                img = Image.new("RGBA", size, (48, 48, 48, 255))
                tmp = out + ".tmp"
                img.save(tmp, format="PNG")
                try:
                    os.replace(tmp, out)
                except Exception:
                    with open(tmp, "rb") as rf, open(out, "wb") as wf:
                        wf.write(rf.read())
                    try:
                        os.remove(tmp)
                    except Exception:
                        pass
            else:
                with open(out, "wb") as f:
                    f.write(_PLACEHOLDER_PNG)
        except Exception:
            with open(out, "wb") as f:
                f.write(_PLACEHOLDER_PNG)
    return out

def build_thumb_force(path: str, size: Tuple[int, int]) -> str:
    out = thumb_path(path, size)
    try:
        if os.path.exists(out):
            os.remove(out)
    except Exception:
        pass
    return build_thumb(path, size)
