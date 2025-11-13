from typing import List, Dict, Any
from PySide6 import QtWidgets, QtGui, QtCore
from ui.photo_card import PhotoCard
from ui.image_viewer import ImageViewer
from utils.win_props import open_properties
import subprocess
import os

class CardGrid(QtWidgets.QWidget):
    item_selected = QtCore.Signal(dict)
    selection_changed = QtCore.Signal(int)

    def __init__(self, columns: int = 3):
        super().__init__()
        self.columns = columns
        self.scroll = QtWidgets.QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.container = QtWidgets.QWidget()
        self.grid = QtWidgets.QGridLayout(self.container)
        self.grid.setContentsMargins(12, 12, 12, 12)
        self.grid.setSpacing(12)
        self.scroll.setWidget(self.container)
        self.scroll.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignTop)
        self.container.setSizePolicy(QtWidgets.QSizePolicy.Policy.Fixed, QtWidgets.QSizePolicy.Policy.Fixed)
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self.scroll)
        self._items: List[Dict[str, Any]] = []
        self._viewer = None
        self._cards_map: dict[str, PhotoCard] = {}
        self._resize_timer = QtCore.QTimer(self)
        self._resize_timer.setSingleShot(True)
        self._resize_timer.setInterval(150)
        self._resize_timer.timeout.connect(self._layout_cards)
        self.scroll.verticalScrollBar().valueChanged.connect(self._render_visible)
        self._cards: List[PhotoCard] = []
        self._selected: set[str] = set()
        self._last_index: int = -1

    def set_items(self, items: List[Dict[str, Any]]):
        self._items = items
        self._selected.clear()
        self._last_index = -1
        while self.grid.count():
            it = self.grid.takeAt(0)
            w = it.widget()
            if w:
                w.hide()
        for it in items:
            cid = str(it.get("id") or it.get("path"))
            card = self._cards_map.get(cid)
            if card is None:
                card = PhotoCard(it)
                card.clicked.connect(lambda it=it: self._on_card_clicked(it))
                card.open_large.connect(self._open_large)
                card.open_props.connect(self._open_props)
                card.open_folder.connect(self._open_folder)
                card.copy_request.connect(self.copy_selected)
                card.delete_request.connect(self.delete_selected)
                self._cards_map[cid] = card
            else:
                pass
        self._layout_cards()
        self.selection_changed.emit(0)

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self._resize_timer.start()

    def _layout_cards(self):
        # clear positions
        while self.grid.count():
            it = self.grid.takeAt(0)
            w = it.widget()
            if w:
                w.hide()
        spacing = self.grid.spacing()
        margins = self.grid.contentsMargins()
        vw = self.scroll.viewport().width() or self.width()
        available = max(1, vw - (margins.left() + margins.right()))
        # 固定3列（或当前固定列数），仅伸缩卡片宽度
        self.columns = max(1, self.columns)
        card_w = int((available - (self.columns - 1) * spacing) / self.columns)
        for col in range(self.columns):
            self.grid.setColumnStretch(col, 0)
            self.grid.setColumnMinimumWidth(col, card_w)
        min_w = self.columns * card_w + (self.columns - 1) * spacing + margins.left() + margins.right()
        self.container.setMinimumWidth(min_w)
        r = 0; c = 0
        for it in self._items:
            cid = str(it.get("id") or it.get("path"))
            card = self._cards_map.get(cid)
            if card is None:
                continue
            try:
                card.set_card_width(card_w)
            except Exception:
                pass
            self.grid.addWidget(card, r, c, QtCore.Qt.AlignmentFlag.AlignLeft | QtCore.Qt.AlignmentFlag.AlignTop)
            card.show()
            c += 1
            if c >= self.columns:
                c = 0
                r += 1
        self._render_visible()
        import math
        rows = max(1, math.ceil(len(self._items) / max(1, self.columns)))
        sample = next(iter(self._cards_map.values())) if self._cards_map else None
        row_h = (sample.height() if sample else 264)
        total_h = rows * row_h + (rows - 1) * spacing + margins.top() + margins.bottom()
        self.container.setMinimumHeight(total_h)
        self.container.setMaximumHeight(total_h)

    def _render_visible(self):
        spacing = self.grid.spacing()
        margins = self.grid.contentsMargins()
        vh = self.scroll.viewport().height()
        if not self._items:
            return
        # 估算每行高度
        any_card = next(iter(self._cards_map.values())) if self._cards_map else None
        row_h = (any_card.height() if any_card else 264) + spacing
        if row_h <= 0:
            row_h = 264
        start_row = int(self.scroll.verticalScrollBar().value() / max(1, row_h))
        rows_fit = int(vh / max(1, row_h)) + 2
        start_idx = max(0, start_row * self.columns)
        end_idx = min(len(self._items), (start_row + rows_fit) * self.columns)
        for i in range(start_idx, end_idx):
            it = self._items[i]
            cid = str(it.get("id") or it.get("path"))
            card = self._cards_map.get(cid)
            if card:
                card.render()

    def _on_card_clicked(self, it: Dict[str, Any]):
        cid = str(it.get("id") or it.get("path"))
        try:
            mods = QtWidgets.QApplication.keyboardModifiers()
        except Exception:
            mods = QtCore.Qt.KeyboardModifier.NoModifier
        idx = 0
        for i, v in enumerate(self._items):
            if str(v.get("id") or v.get("path")) == cid:
                idx = i
                break
        if mods & QtCore.Qt.KeyboardModifier.ShiftModifier:
            start = self._last_index if self._last_index >= 0 else idx
            a, b = sorted([start, idx])
            for i in range(a, b + 1):
                cid2 = str(self._items[i].get("id") or self._items[i].get("path"))
                self._selected.add(cid2)
        elif mods & QtCore.Qt.KeyboardModifier.ControlModifier:
            if cid in self._selected:
                self._selected.remove(cid)
            else:
                self._selected.add(cid)
            self._last_index = idx
        else:
            self._selected = {cid}
            self._last_index = idx
        for k, card in self._cards_map.items():
            card.set_selected(k in self._selected)
        self.item_selected.emit(it)
        self.selection_changed.emit(len(self._selected))
        try:
            QtWidgets.QApplication.instance().setProperty("selected_count", len(self._selected))
        except Exception:
            pass

    def copy_selected(self):
        paths: List[str] = []
        for cid in self._selected:
            # find item by cid
            for it in self._items:
                if str(it.get("id") or it.get("path")) == cid:
                    p = it.get("path")
                    if p:
                        paths.append(p)
                    break
        if not paths:
            return
        mime = QtCore.QMimeData()
        mime.setText("\n".join(paths))
        urls = [QtCore.QUrl.fromLocalFile(p) for p in paths]
        mime.setUrls(urls)
        QtWidgets.QApplication.clipboard().setMimeData(mime)

    def delete_selected(self):
        if not self._selected:
            return
        from utils.win_delete import delete_to_recycle_bin
        paths: List[str] = []
        keep_items: List[Dict[str, Any]] = []
        for it in self._items:
            cid = str(it.get("id") or it.get("path"))
            if cid in self._selected:
                if it.get("path"):
                    paths.append(it.get("path"))
            else:
                keep_items.append(it)
        if not paths:
            return
        resp = QtWidgets.QMessageBox.question(
            self,
            "确认删除",
            f"删除选中 {len(paths)} 项并移动到回收站？",
            QtWidgets.QMessageBox.Yes | QtWidgets.QMessageBox.No,
            QtWidgets.QMessageBox.No,
        )
        if resp != QtWidgets.QMessageBox.Yes:
            return
        ok = False
        try:
            ok = delete_to_recycle_bin(paths)
        except Exception:
            ok = False
        if ok:
            self._items = keep_items
            # 清除已删除的卡片
            for p in list(self._selected):
                card = self._cards_map.pop(p, None)
                if card:
                    card.hide()
            self._selected.clear()
            self._last_index = -1
            self._layout_cards()
            self.selection_changed.emit(0)

    def _open_large(self, it: Dict[str, Any]):
        if self._viewer is None:
            self._viewer = ImageViewer(self)
        self._viewer.open_path(it.get("path"))
        self._viewer.exec()

    def _open_props(self, it: Dict[str, Any]):
        p = it.get("path")
        if p:
            try:
                open_properties(p)
            except Exception:
                pass

    def _open_folder(self, it: Dict[str, Any]):
        p = it.get("path")
        if p:
            try:
                subprocess.run(["explorer", "/select,", p])
            except Exception:
                try:
                    os.startfile(os.path.dirname(p))
                except Exception:
                    pass
