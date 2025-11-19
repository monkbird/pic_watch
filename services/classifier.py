import json
import os
import time
import re
from typing import List, Dict, Any, Optional

def group_by_folder(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        k = it.get("parent") or os.path.dirname(it.get("path") or "")
        res.setdefault(k, []).append(it)
    return res

def _date_of(it: Dict[str, Any]) -> str:
    exif = it.get("exif") or {}
    dt = exif.get("DateTimeOriginal") or exif.get("DateTime")
    if isinstance(dt, str) and dt:
        try:
            s = dt.replace("-", ":").replace("T", " ")
            parts = s.split()
            ymd = parts[0].split(":")
            return f"{ymd[0]}-{ymd[1]}-{ymd[2]}"
        except Exception:
            pass
    ts = it.get("mtime") or time.time()
    t = time.localtime(ts)
    return f"{t.tm_year}-{t.tm_mon:02d}-{t.tm_mday:02d}"

def group_by_time(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        k = earliest_date_string(it)
        res.setdefault(k, []).append(it)
    return res

def group_by_year(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        ts = earliest_timestamp(it)
        t = time.localtime(ts)
        y = str(t.tm_year)
        res.setdefault(y, []).append(it)
    return res

def group_by_desc_segments(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        exif = it.get("exif") or {}
        desc = exif.get("ImageDescription")
        if not isinstance(desc, str) or not desc.strip():
            continue
        parts = [p.strip() for p in desc.split("_") if p.strip()]
        for p in parts:
            res.setdefault(p, []).append(it)
    return res

def group_by_tags(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        tags: List[str] = []
        iptc = it.get("iptc") or {}
        kw = iptc.get("Keywords") or iptc.get("keywords")
        if isinstance(kw, list):
            for v in kw:
                s = str(v).strip()
                if s:
                    tags.append(s)
        elif isinstance(kw, str) and kw.strip():
            for p in re.split(r"[;，,;|/]+", kw):
                q = p.strip()
                if q:
                    tags.append(q)
        exif = it.get("exif") or {}
        xp = exif.get("XPKeywords")
        if isinstance(xp, str) and xp.strip():
            for p in re.split(r"[;，,;|/]+", xp):
                q = p.strip()
                if q:
                    tags.append(q)
        seen = set()
        for t in tags:
            k = t.lower()
            if k in seen:
                continue
            seen.add(k)
            res.setdefault(t, []).append(it)
    return res

def _parse_dt_from_filename(path: str) -> Optional[float]:
    base = os.path.basename(path)
    m = re.search(r"(20\d{6})(\d{6})", base)
    if m:
        ymd = m.group(1)
        hms = m.group(2)
        try:
            t = time.strptime(f"{ymd[0:4]}-{ymd[4:6]}-{ymd[6:8]} {hms[0:2]}:{hms[2:4]}:{hms[4:6]}", "%Y-%m-%d %H:%M:%S")
            return time.mktime(t)
        except Exception:
            pass
    m = re.search(r"(20\d{2})(\d{2})(\d{2})[^\d]+(\d{2})(\d{2})(\d{2})", base)
    if m:
        y, mo, d, hh, mm, ss = map(int, m.groups())
        try:
            t = time.strptime(f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}", "%Y-%m-%d %H:%M:%S")
            return time.mktime(t)
        except Exception:
            pass
    m = re.search(r"(20\d{2})[-_\. ](\d{1,2})[-_\. ](\d{1,2})(?:[^\d]*(\d{2})[^\d]?(\d{2})(?:[^\d]?(\d{2}))?)?", base)
    if m:
        y = int(m.group(1)); mo = int(m.group(2)); d = int(m.group(3))
        hh = int(m.group(4) or 0); mm = int(m.group(5) or 0); ss = int(m.group(6) or 0)
        try:
            t = time.strptime(f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}", "%Y-%m-%d %H:%M:%S")
            return time.mktime(t)
        except Exception:
            pass
    m = re.search(r"(20\d{2})(\d{2})(\d{2})", base)
    if m:
        y, mo, d = map(int, m.groups())
        try:
            t = time.strptime(f"{y}-{mo:02d}-{d:02d} 00:00:00", "%Y-%m-%d %H:%M:%S")
            return time.mktime(t)
        except Exception:
            pass
    m = re.search(r"(20\d{2})年(\d{1,2})月(\d{1,2})日(?:[ _-]*(\d{1,2})[:：](\d{1,2})(?:[:：](\d{1,2}))?)?", base)
    if m:
        y = int(m.group(1))
        mo = int(m.group(2))
        d = int(m.group(3))
        hh = int(m.group(4) or 0)
        mm = int(m.group(5) or 0)
        ss = int(m.group(6) or 0)
        try:
            t = time.strptime(f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}:{ss:02d}", "%Y-%m-%d %H:%M:%S")
            return time.mktime(t)
        except Exception:
            pass
    return None

def _parse_exif_dt(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace("T", " ")
    a = s.split()
    if not a:
        return None
    date = a[0].replace(":", "-")
    rest = a[1] if len(a) > 1 else "00:00:00"
    try:
        t = time.strptime(f"{date} {rest}", "%Y-%m-%d %H:%M:%S")
        return time.mktime(t)
    except Exception:
        return None

def earliest_timestamp(it: Dict[str, Any]) -> float:
    exif = it.get("exif") or {}
    cands: List[float] = []
    for k in ["DateTimeOriginal", "DateTime"]:
        ts = _parse_exif_dt(exif.get(k) if isinstance(exif.get(k), str) else None)
        if ts is not None:
            cands.append(ts)
    for k in ["mtime", "ctime"]:
        v = it.get(k)
        if isinstance(v, (int, float)):
            cands.append(float(v))
    fn = _parse_dt_from_filename(it.get("path") or "")
    if fn is not None:
        cands.append(fn)
    if not cands:
        return time.time()
    return min(cands)

def earliest_date_string(it: Dict[str, Any]) -> str:
    ts = earliest_timestamp(it)
    t = time.localtime(ts)
    return f"{t.tm_year}-{t.tm_mon:02d}-{t.tm_mday:02d}"

def group_by_remark(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    res: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        iptc = it.get("iptc") or {}
        k = iptc.get("caption/abstract") or iptc.get("Caption") or iptc.get("ObjectName") or "无备注"
        if isinstance(k, list) and k:
            k = k[0]
        res.setdefault(str(k), []).append(it)
    return res

def export_groups(groups: Dict[str, List[Dict[str, Any]]], output_path: str) -> None:
    data = {"groups": {k: [x.get("id") for x in v] for k, v in groups.items()}, "group_count": len(groups)}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
