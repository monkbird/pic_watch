from typing import Dict, Any, Optional
from PySide6 import QtWidgets, QtGui, QtCore
from utils.thumb_cache import thumb_path, build_thumb, bucket_size, build_thumb_force
from utils.thumb_worker import enqueue_build
from services.classifier import earliest_date_string

def _human_size(n: Optional[int]) -> str:
    if not isinstance(n, (int, float)):
        return ""
    units = ["B", "KB", "MB", "GB"]
    s = float(n)
    i = 0
    while s >= 1024 and i < len(units) - 1:
        s /= 1024
        i += 1
    return f"{s:.1f}{units[i]}"

class PhotoCard(QtWidgets.QFrame):
    clicked = QtCore.Signal(dict)
    open_large = QtCore.Signal(dict)
    open_props = QtCore.Signal(dict)
    open_folder = QtCore.Signal(dict)
    copy_request = QtCore.Signal()
    delete_request = QtCore.Signal()

    def __init__(self, item: Dict[str, Any]):
        super().__init__()
        self.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
        self.setLineWidth(1)
        self._item = item
        self._card_w = 320
        self._card_h = 264
        self.setFixedSize(self._card_w, self._card_h)
        self.setSizePolicy(QtWidgets.QSizePolicy.Policy.Fixed, QtWidgets.QSizePolicy.Policy.Fixed)
        self.image = QtWidgets.QLabel()
        self.image.setAlignment(QtGui.Qt.AlignmentFlag.AlignCenter)
        self.image.setFixedHeight(180)
        self.title = QtWidgets.QLabel()
        self.title.setFixedHeight(24)
        self.meta = QtWidgets.QLabel()
        self.meta.setFixedHeight(18)
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 6, 6)
        lay.setSpacing(0)
        lay.addWidget(self.image)
        lay.addWidget(self.title)
        lay.addWidget(self.meta)
        self._last_thumb: str = ""
        self._pm: Optional[QtGui.QPixmap] = None
        self._selected: bool = False
        self._apply_style()
        self.setContextMenuPolicy(QtCore.Qt.ContextMenuPolicy.CustomContextMenu)
        self.customContextMenuRequested.connect(self._on_context)
        self._populate()

    def _thumb(self) -> QtGui.QPixmap:
        p = self._item.get("path")
        size = (max(100, self._card_w - 20), max(80, self.image.height()))
        bs = bucket_size(size)
        tp = thumb_path(p, bs)
        if self._pm is not None and self._last_thumb == tp:
            return self._pm
        if not QtCore.QFile.exists(tp):
            enqueue_build(p, bs, lambda: self._on_thumb_ready(tp))
            return self._pm or QtGui.QPixmap()
        pm = QtGui.QPixmap()
        pm.load(tp)
        self._pm = pm
        self._last_thumb = tp
        return pm

    def _on_thumb_ready(self, tp: str):
        pm = QtGui.QPixmap()
        ok = pm.load(tp)
        if not ok:
            # 尝试强制重建一次
            size = (max(100, self._card_w - 20), max(80, self.image.height()))
            bs = bucket_size(size)
            try:
                build_thumb_force(self._item.get("path"), bs)
                ok = pm.load(thumb_path(self._item.get("path"), bs))
            except Exception:
                ok = False
            if not ok:
                pm = QtGui.QPixmap(self._card_w - 20, self.image.height())
                pm.fill(QtGui.QColor(48, 48, 48))
        self._pm = pm
        self._last_thumb = tp
        try:
            self.image.setPixmap(pm.scaled(self._card_w - 20, self.image.height(), QtGui.Qt.AspectRatioMode.KeepAspectRatio, QtGui.Qt.TransformationMode.SmoothTransformation))
        except Exception:
            pass

    def _populate(self):
        pm = self._thumb()
        if pm.isNull():
            pm = QtGui.QPixmap(self._card_w - 20, self.image.height())
            pm.fill(QtGui.QColor(48, 48, 48))
        self.image.setPixmap(pm.scaled(self._card_w - 20, self.image.height(), QtGui.Qt.AspectRatioMode.KeepAspectRatio, QtGui.Qt.TransformationMode.SmoothTransformation))
        name = self._item.get("rel_path") or self._item.get("path")
        text = str(name)
        fm = QtGui.QFontMetrics(self.title.font())
        self.title.setText(fm.elidedText(text, QtCore.Qt.TextElideMode.ElideRight, self._card_w - 20))
        fmt = str(self._item.get("format") or "")
        wh = f"{self._item.get('width') or ''}x{self._item.get('height') or ''}"
        size = _human_size(self._item.get("file_size"))
        date = earliest_date_string(self._item)
        meta_text = f"{fmt} • {wh} • {size} • {date}"
        self.meta.setText(fm.elidedText(meta_text, QtCore.Qt.TextElideMode.ElideRight, self._card_w - 20))

    def _apply_style(self):
        if self._selected:
            self.setStyleSheet("QFrame{background:#ff8c00;border-radius:6px;} QLabel{color:#000;} ")
        else:
            self.setStyleSheet("")

    def set_selected(self, sel: bool):
        self._selected = bool(sel)
        self._apply_style()

    def set_card_width(self, w: int):
        self._card_w = max(240, int(w))
        img_h = int(self._card_w * 0.56)
        self.image.setFixedHeight(img_h)
        self._card_h = img_h + self.title.height() + self.meta.height() + 12
        self.setFixedSize(self._card_w, self._card_h)
        # 延迟渲染，避免在批量布局时阻塞

    def render(self):
        self._populate()

    def mousePressEvent(self, e: QtGui.QMouseEvent):
        super().mousePressEvent(e)
        if e.button() == QtCore.Qt.MouseButton.LeftButton:
            self.clicked.emit(self._item)

    def _on_context(self, pos: QtCore.QPoint):
        sel_count = 1
        try:
            prop = QtWidgets.QApplication.instance().property("selected_count")
            if isinstance(prop, int):
                sel_count = prop
        except Exception:
            pass
        menu = QtWidgets.QMenu(self)
        if sel_count >= 2:
            acopy = menu.addAction("复制选中")
            adel = menu.addAction("删除选中")
            a = menu.exec(self.mapToGlobal(pos))
            if a == acopy:
                self.copy_request.emit()
            elif a == adel:
                self.delete_request.emit()
            return
        aopen = menu.addAction("打开大图")
        aprop = menu.addAction("查看属性")
        afolder = menu.addAction("打开所在文件夹")
        acopy = menu.addAction("复制选中")
        adel = menu.addAction("删除选中")
        a = menu.exec(self.mapToGlobal(pos))
        if a == aopen:
            self.open_large.emit(self._item)
        elif a == aprop:
            self.open_props.emit(self._item)
        elif a == afolder:
            self.open_folder.emit(self._item)
        elif a == acopy:
            self.copy_request.emit()
        elif a == adel:
            self.delete_request.emit()

    def mouseDoubleClickEvent(self, e: QtGui.QMouseEvent):
        super().mouseDoubleClickEvent(e)
        self.open_large.emit(self._item)
