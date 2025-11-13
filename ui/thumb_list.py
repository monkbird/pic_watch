from typing import List, Dict, Any, Optional
from PySide6 import QtWidgets, QtGui, QtCore
from utils.thumb_cache import thumb_path, build_thumb
from utils.logger import get_logger
import os
import subprocess
from ui.image_viewer import ImageViewer
from utils.win_props import open_properties

class ThumbList(QtWidgets.QWidget):
    item_selected = QtCore.Signal(dict)

    def __init__(self):
        super().__init__()
        self.view = QtWidgets.QListView()
        self.view.setViewMode(QtWidgets.QListView.ViewMode.IconMode)
        self.view.setResizeMode(QtWidgets.QListView.ResizeMode.Adjust)
        self.view.setIconSize(QtCore.QSize(160, 160))
        self.view.setSpacing(8)
        self.model = QtGui.QStandardItemModel()
        self.view.setModel(self.model)
        self.view.doubleClicked.connect(self._on_double)
        self.view.setContextMenuPolicy(QtCore.Qt.ContextMenuPolicy.CustomContextMenu)
        self.view.customContextMenuRequested.connect(self._on_context)
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self.view)
        self.view.selectionModel().selectionChanged.connect(self._on_sel)
        self._timer = QtCore.QTimer(self)
        self._timer.setInterval(10)
        self._timer.timeout.connect(self._warm_one)
        self._items: List[Dict[str, Any]] = []
        self._viewer = None

    def set_items(self, items: List[Dict[str, Any]]):
        self._items = items
        self.model.clear()
        for it in items:
            icon = self._make_icon(it.get("path"))
            text = it.get("rel_path") or it.get("path")
            si = QtGui.QStandardItem(icon, text)
            si.setEditable(False)
            si.setData(it, QtCore.Qt.ItemDataRole.UserRole)
            self.model.appendRow(si)
        self._warm_index = 0
        self._timer.start()

    def _make_icon(self, path: Optional[str]) -> QtGui.QIcon:
        if not path:
            return QtGui.QIcon()
        tp = thumb_path(path, (160, 160))
        if not QtCore.QFile.exists(tp):
            return QtGui.QIcon()
        pm = QtGui.QPixmap()
        pm.load(tp)
        return QtGui.QIcon(pm)

    def _warm_one(self):
        if self._warm_index >= self.model.rowCount():
            self._timer.stop()
            return
        item = self.model.item(self._warm_index)
        self._warm_index += 1
        path = item.data(QtCore.Qt.ItemDataRole.UserRole).get("path")
        tp = thumb_path(path, (160, 160))
        if not QtCore.QFile.exists(tp):
            build_thumb(path, (160, 160))
            pm = QtGui.QPixmap()
            pm.load(tp)
            item.setIcon(QtGui.QIcon(pm))
        if self._warm_index % 50 == 0:
            try:
                get_logger().info("缩略图生成进度: %d/%d", self._warm_index, self.model.rowCount())
            except Exception:
                pass

    def _on_sel(self):
        idxs = self.view.selectedIndexes()
        if not idxs:
            return
        idx = idxs[0]
        it = idx.data(QtCore.Qt.ItemDataRole.UserRole)
        if not it:
            it = self.model.itemFromIndex(idx).data()
        if isinstance(it, dict):
            self.item_selected.emit(it)

    def _get_item_at_pos(self, pos) -> Optional[Dict[str, Any]]:
        idx = self.view.indexAt(pos)
        if not idx.isValid():
            return None
        it = idx.data(QtCore.Qt.ItemDataRole.UserRole)
        if not it:
            it = self.model.itemFromIndex(idx).data()
        return it if isinstance(it, dict) else None

    def _on_double(self, idx: QtCore.QModelIndex):
        it = idx.data(QtCore.Qt.ItemDataRole.UserRole)
        if not isinstance(it, dict):
            return
        path = it.get("path")
        if not path:
            return
        if self._viewer is None:
            self._viewer = ImageViewer(self)
        self._viewer.open_path(path)
        self._viewer.exec()

    def _on_context(self, pos):
        it = self._get_item_at_pos(pos)
        if not it:
            return
        menu = QtWidgets.QMenu(self)
        act_open = menu.addAction("打开大图")
        act_prop = menu.addAction("查看属性")
        act_folder = menu.addAction("打开所在文件夹")
        a = menu.exec(self.view.mapToGlobal(pos))
        if a == act_open:
            if self._viewer is None:
                self._viewer = ImageViewer(self)
            self._viewer.open_path(it.get("path"))
            self._viewer.exec()
        elif a == act_prop:
            p = it.get("path")
            if p:
                try:
                    open_properties(p)
                except Exception:
                    pass
        elif a == act_folder:
            p = it.get("path")
            if p:
                try:
                    subprocess.run(["explorer", "/select,", p])
                except Exception:
                    try:
                        os.startfile(os.path.dirname(p))
                    except Exception:
                        pass
