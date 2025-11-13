import os
import hashlib
import re
from typing import Dict, Any, Optional, List, Union

try:
    from PIL import Image, ExifTags
except Exception:
    Image = None
    ExifTags = None

try:
    from iptcinfo3 import IPTCInfo
except Exception:
    IPTCInfo = None

try:
    import tifffile as _tifffile
except Exception:
    _tifffile = None

try:
    import piexif as _piexif
except Exception:
    _piexif = None

def _sha1(text: str) -> str:
    h = hashlib.sha1()
    h.update(text.encode("utf-8", errors="ignore"))
    return h.hexdigest()

def _to_bytes(value: Any) -> Optional[bytes]:
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    if isinstance(value, list) and value and isinstance(value[0], int):
        try:
            return bytes(value)
        except Exception:
            return None
    return None

def _decode_text_bytes(data: bytes) -> str:
    if data.startswith(b"\xff\xfe"):
        try:
            return data.decode("utf-16le")
        except Exception:
            pass
    if data.startswith(b"\xfe\xff"):
        try:
            return data.decode("utf-16be")
        except Exception:
            pass
    zeros = data.count(b"\x00")
    if zeros and zeros * 2 >= len(data):
        try:
            return data.decode("utf-16le")
        except Exception:
            try:
                return data.decode("utf-16be")
            except Exception:
                pass
    for enc in ("utf-8", "gb18030", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="ignore")

def _redecode_text(s: str) -> str:
    try:
        b = s.encode("latin-1")
        try:
            return b.decode("utf-8")
        except Exception:
            return b.decode("gb18030")
    except Exception:
        return s

def _decode_exif_value(name: str, value: Any) -> Any:
    if name in ("XPTitle", "XPComment", "XPAuthor", "XPKeywords", "XPSubject"):
        b = _to_bytes(value)
        if b is not None:
            try:
                s = b.decode("utf-16le", errors="ignore")
                return s.replace("\x00", "").strip()
            except Exception:
                pass
    if name == "ImageDescription" and isinstance(value, str):
        return _redecode_text(value)
    if name == "UserComment":
        b = _to_bytes(value)
        if b is not None:
            if b.startswith(b"UNICODE\x00"):
                return b[8:].decode("utf-16", errors="ignore").strip()
            if b.startswith(b"ASCII\x00"):
                return b[6:].decode("ascii", errors="ignore").strip()
            if b.startswith(b"JIS\x00"):
                try:
                    return b[5:].decode("shift_jis")
                except Exception:
                    pass
            return _decode_text_bytes(b)
    if isinstance(value, bytes):
        return _decode_text_bytes(value)
    return value

def _should_keep_exif(name: str, value: Any) -> bool:
    bad_keys = {"MakerNote", "ExifOffset"}
    if name in bad_keys:
        return False
    if isinstance(value, (bytes, bytearray)):
        b = bytes(value)
        if len(b) > 4096:
            return False
        nonprint = sum(ch < 32 and ch not in (9, 10, 13) for ch in b)
        if nonprint / max(1, len(b)) > 0.5:
            return False
    return True

def _is_vendor_private(key: Any, name: str) -> bool:
    try:
        kid = int(key)
    except Exception:
        kid = None
    if name == str(key):
        if kid is not None and (kid >= 50000 or kid == 37500):
            return True
    return False

def _read_exif(img) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if not img:
        return data
    try:
        exif = img.getexif()
        if exif and ExifTags and hasattr(ExifTags, "TAGS"):
            for k, v in exif.items():
                name = ExifTags.TAGS.get(k, str(k))
                val = _decode_exif_value(name, v)
                if not _is_vendor_private(k, name) and _should_keep_exif(name, val):
                    data[name] = val
        else:
            for k, v in exif.items():
                name = str(k)
                val = _decode_exif_value(name, v)
                if not _is_vendor_private(k, name) and _should_keep_exif(name, val):
                    data[name] = val
    except Exception:
        pass
    return data

def _read_exif_piexif(path: str) -> Dict[str, Any]:
    if _piexif is None:
        return {}
    out: Dict[str, Any] = {}
    try:
        ex = _piexif.load(path)
        def put(tag_name: str, raw: Any):
            val = _decode_exif_value(tag_name, raw)
            if _should_keep_exif(tag_name, val):
                out[tag_name] = val
        zeroth = ex.get("0th") or {}
        exif_ifd = ex.get("Exif") or {}
        gps = ex.get("GPS") or {}
        first = ex.get("1st") or {}
        # Common tags
        for tag, name in [
            (0x010E, "ImageDescription"), (0x010F, "Make"), (0x0110, "Model"), (0x0112, "Orientation"),
            (0x0131, "Software"), (0x013B, "Artist"), (0x0132, "DateTime"),
            (0x9C9B, "XPTitle"), (0x9C9C, "XPComment"), (0x9C9D, "XPAuthor"), (0x9C9E, "XPKeywords"), (0x9C9F, "XPSubject"),
        ]:
            if tag in zeroth:
                put(name, zeroth[tag])
        if 0x9003 in exif_ifd:
            put("DateTimeOriginal", exif_ifd[0x9003])
        # Resolution
        for tag, name in [(0x011A, "XResolution"), (0x011B, "YResolution"), (0x0128, "ResolutionUnit")]:
            if tag in zeroth:
                put(name, zeroth[tag])
        # GPS presence
        if gps:
            out["GPSInfo"] = True
    except Exception:
        return {}
    return out

def _parse_dt_from_filename(path: str) -> Optional[str]:
    base = os.path.basename(path)
    m = re.search(r"(20\d{6})(\d{6})", base)
    if m:
        ymd = m.group(1)
        hms = m.group(2)
        return f"{ymd[0:4]}-{ymd[4:6]}-{ymd[6:8]} {hms[0:2]}:{hms[2:4]}:{hms[4:6]}"
    m = re.search(r"(20\d{2})(\d{2})(\d{2})[^\d]+(\d{2})(\d{2})(\d{2})", base)
    if m:
        y, mo, d, hh, mm, ss = map(int, m.groups())
        return f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}"
    m = re.search(r"(20\d{2})[-_\. ](\d{1,2})[-_\. ](\d{1,2})(?:[^\d]*(\d{2})[^\d]?(\d{2})(?:[^\d]?(\d{2}))?)?", base)
    if m:
        y = int(m.group(1)); mo = int(m.group(2)); d = int(m.group(3))
        hh = int(m.group(4) or 0); mm = int(m.group(5) or 0); ss = int(m.group(6) or 0)
        return f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}"
    m = re.search(r"(20\d{2})(\d{2})(\d{2})", base)
    if m:
        y, mo, d = map(int, m.groups())
        return f"{y}-{mo:02d}-{d:02d} 00:00:00"
    # Chinese: YYYY年MM月DD日 可带 时分秒
    m = re.search(r"(20\d{2})年(\d{1,2})月(\d{1,2})日(?:[ _-]*(\d{1,2})[:：](\d{1,2})(?:[:：](\d{1,2}))?)?", base)
    if m:
        y = m.group(1)
        mo = int(m.group(2))
        d = int(m.group(3))
        hh = int(m.group(4) or 0)
        mm = int(m.group(5) or 0)
        ss = int(m.group(6) or 0)
        return f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}"
    return None

def _read_iptc(path: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if IPTCInfo is None:
        return data
    try:
        info = IPTCInfo(path, force=True)
        for k in info:
            v = info[k]
            if isinstance(v, list):
                out: List[Union[str, Any]] = []
                for x in v:
                    b = _to_bytes(x)
                    if b is not None:
                        out.append(_decode_text_bytes(b))
                    else:
                        out.append(x)
                data[str(k)] = out
            elif isinstance(v, (bytes, bytearray)):
                b = bytes(v)
                if b.startswith(b"\x1B%G"):
                    try:
                        data[str(k)] = b.decode("utf-8", errors="ignore")
                    except Exception:
                        data[str(k)] = _decode_text_bytes(b)
                else:
                    data[str(k)] = _decode_text_bytes(b)
            else:
                data[str(k)] = v
    except Exception:
        pass
    return data

def extract_metadata(file_path: str, root_path: Optional[str] = None) -> Dict[str, Any]:
    p = os.path.abspath(file_path)
    stat = os.stat(p)
    parent = os.path.dirname(p)
    rel_path = os.path.relpath(p, root_path) if root_path else p
    item: Dict[str, Any] = {
        "id": _sha1(p),
        "path": p,
        "rel_path": rel_path,
        "parent": parent,
        "format": None,
        "width": None,
        "height": None,
        "pages": None,
        "file_size": stat.st_size,
        "mtime": stat.st_mtime,
        "ctime": stat.st_ctime,
        "exif": {},
        "iptc": {},
    }
    img = None
    if Image is not None:
        try:
            img = Image.open(p)
            item["format"] = img.format
            w, h = img.size
            item["width"] = int(w)
            item["height"] = int(h)
        except Exception:
            img = None
    item["exif"] = _read_exif(img)
    # piexif fallback: fill missing keys
    try:
        pie = _read_exif_piexif(p)
        for k, v in pie.items():
            if k not in item["exif"]:
                item["exif"][k] = v
    except Exception:
        pass
    # Filename fallback for DateTimeOriginal
    if not item["exif"].get("DateTimeOriginal"):
        dt = _parse_dt_from_filename(p)
        if dt:
            item["exif"]["DateTimeOriginal"] = dt
    if (item.get("format") in ("TIFF", "TIF") or p.lower().endswith(('.tif', '.tiff'))) and _tifffile is not None:
        try:
            with _tifffile.TiffFile(p) as tf:
                pages = len(tf.pages)
                item["pages"] = pages
                page0 = tf.pages[0]
                try:
                    shape = page0.asarray().shape
                    h = shape[0]
                    w = shape[1]
                    item["width"] = int(w)
                    item["height"] = int(h)
                except Exception:
                    pass
                tiff_tags = {}
                for tag in page0.tags.values():
                    name = str(tag.name)
                    value = tag.value
                    tiff_tags[name] = _safe_str(value)
                # 合并到 exif 下的 tiff 子字典以保留结构
                item["exif"]["tiff_tags"] = tiff_tags
        except Exception:
            pass
    item["iptc"] = _read_iptc(p)
    return item
