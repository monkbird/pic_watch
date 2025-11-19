from typing import List, Dict, Any
from PySide6 import QtWidgets, QtCore
import os
import time
import re
from services.classifier import earliest_date_string

class ClassificationPanel(QtWidgets.QWidget):
    group_selected = QtCore.Signal(list)

    def __init__(self):
        super().__init__()
        self.items: List[Dict[str, Any]] = []
        self.mode_box = QtWidgets.QComboBox()
        self.mode_box.addItems(["文件夹", "时间", "年份", "备注", "标签"])
        self.tree = QtWidgets.QTreeWidget()
        self.tree.setHeaderLabels(["分组", "数量"])
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self.mode_box)
        lay.addWidget(self.tree)
        self.tree.itemSelectionChanged.connect(self._on_sel)
        self.mode_box.currentIndexChanged.connect(self._rebuild)
        self._apply_header_style()

    def set_items(self, items: List[Dict[str, Any]]):
        self.items = items
        self._rebuild()

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self._apply_widths()

    def _rebuild(self):
        self.tree.clear()
        mode = self.mode_box.currentText()
        if mode == "文件夹":
            self._build_by_folders()
        elif mode == "时间":
            self._build_by_time()
        elif mode == "年份":
            self._build_by_year()
        elif mode == "备注":
            self._build_by_desc_segments()
        elif mode == "标签":
            self._build_by_tags()
        self._apply_header_style()
        self._apply_widths()

    def _apply_header_style(self):
        try:
            hdr = self.tree.headerItem()
            if hdr:
                hdr.setTextAlignment(0, QtCore.Qt.AlignmentFlag.AlignCenter)
                hdr.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
        except Exception:
            pass

    def _apply_widths(self):
        try:
            total = max(100, self.tree.viewport().width())
            w0 = int(total * 0.7)
            w1 = total - w0
            self.tree.setColumnWidth(0, w0)
            self.tree.setColumnWidth(1, w1)
        except Exception:
            pass

    def _build_by_folders(self):
        folders: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
            parent = it.get("parent") or os.path.dirname(it.get("path") or "")
            folders.setdefault(parent, []).append(it)
        for folder, lst in sorted(folders.items()):
            node = QtWidgets.QTreeWidgetItem([folder, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _date_of(self, it: Dict[str, Any]) -> str:
        return earliest_date_string(it)

    def _build_by_time(self):
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
            key = self._date_of(it)
            groups.setdefault(key, []).append(it)
        for date_key in sorted(groups.keys()):
            lst = groups[date_key]
            node = QtWidgets.QTreeWidgetItem([date_key, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _build_by_year(self):
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
            exif = it.get("exif") or {}
            dt = exif.get("DateTimeOriginal") or exif.get("DateTime")
            year = None
            if isinstance(dt, str) and dt:
                try:
                    s = dt.replace("-", ":").replace("T", " ")
                    parts = s.split()
                    ymd = parts[0].split(":")
                    year = ymd[0]
                except Exception:
                    year = None
            if not year:
                ts = it.get("mtime") or time.time()
                t = time.localtime(ts)
                year = str(t.tm_year)
            groups.setdefault(year, []).append(it)
        for y in sorted(groups.keys()):
            lst = groups[y]
            node = QtWidgets.QTreeWidgetItem([y, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _build_by_remark(self):
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
            iptc = it.get("iptc") or {}
            remark = iptc.get("caption/abstract") or iptc.get("Caption") or iptc.get("ObjectName") or "无备注"
            if isinstance(remark, list) and remark:
                remark = remark[0]
            groups.setdefault(str(remark), []).append(it)
        for k in sorted(groups.keys()):
            lst = groups[k]
            node = QtWidgets.QTreeWidgetItem([k, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _build_by_desc_segments(self):
        groups: Dict[str, List[Dict[str, Any]]] = {}
        stop = {"default", "suva", "unknown", "none", "nil"}
        for it in self.items:
            exif = it.get("exif") or {}
            desc = exif.get("ImageDescription")
            if not isinstance(desc, str) or not desc.strip():
                continue
            parts = [p.strip() for p in re.split(r"[\s_，,;|]+", desc) if p.strip()]
            clean: List[str] = []
            for p in parts:
                q = re.sub(r"[^A-Za-z0-9\u4e00-\u9fff]", "", p)
                if not q or len(q) < 2:
                    continue
                if q.lower() in stop:
                    continue
                clean.append(q)
            parts = clean
            for p in parts:
                groups.setdefault(p, []).append(it)
        for k in sorted(groups.keys()):
            lst = groups[k]
            node = QtWidgets.QTreeWidgetItem([k, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _build_by_tags(self):
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for it in self.items:
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
            uniq: List[str] = []
            for t in tags:
                k = t.lower()
                if k in seen:
                    continue
                seen.add(k)
                uniq.append(t)
            for t in uniq:
                groups.setdefault(t, []).append(it)
        for k in sorted(groups.keys()):
            lst = groups[k]
            node = QtWidgets.QTreeWidgetItem([k, str(len(lst))])
            node.setData(0, QtCore.Qt.ItemDataRole.UserRole, lst)
            node.setTextAlignment(1, QtCore.Qt.AlignmentFlag.AlignCenter)
            self.tree.addTopLevelItem(node)

    def _on_sel(self):
        idxs = self.tree.selectedItems()
        if not idxs:
            return
        node = idxs[0]
        lst = node.data(0, QtCore.Qt.ItemDataRole.UserRole)
        if isinstance(lst, list):
            self.group_selected.emit(lst)
