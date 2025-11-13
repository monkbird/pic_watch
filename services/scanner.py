import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

from services.metadata import extract_metadata

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".gif", ".webp", ".heic", ".heif", ".jfif"}

def _is_image(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in ALLOWED_EXTENSIONS

def _iter_files(root: str) -> List[str]:
    files: List[str] = []
    for base, dirs, names in os.walk(root):
        names.sort()
        for n in names:
            p = os.path.join(base, n)
            if _is_image(p):
                files.append(p)
    return files

def scan_directory(root: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    files = _iter_files(root)
    if not files:
        return items
    workers = min(32, max(4, os.cpu_count() or 4))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(extract_metadata, f, root): f for f in files}
        for fut in as_completed(futures):
            try:
                items.append(fut.result())
            except Exception:
                pass
    return items

def export_json(items: List[Dict[str, Any]], output_path: str) -> None:
    data = {
        "count": len(items),
        "items": items,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
