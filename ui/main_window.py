from typing import List, Dict, Any
from PySide6 import QtWidgets, QtCore, QtGui
import logging

from services.scanner import scan_directory
from ui.card_grid import CardGrid
from ui.classification_panel import ClassificationPanel
from utils.logger import get_logger, QtLogHandler

class MainWindow(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("图片查看工具")
        self.resize(1200, 800)
        self.items: List[Dict[str, Any]] = []
        self.root: str = ""
        self._build_ui()

    def _build_ui(self):
        tb = QtWidgets.QToolBar()
        self.addToolBar(tb)
        act_open = QtGui.QAction("选择文件夹", self)
        act_open.triggered.connect(self.on_open_folder)
        tb.addAction(act_open)
        act_export_groups = QtGui.QAction("导出分组", self)
        act_export_groups.triggered.connect(self.on_export_groups)
        tb.addAction(act_export_groups)
        act_refresh = QtGui.QAction("刷新", self)
        act_refresh.triggered.connect(self.on_refresh)
        tb.addAction(act_refresh)
        act_log = QtGui.QAction("日志", self)
        act_log.setCheckable(True)
        act_log.toggled.connect(self.on_toggle_log)
        tb.addAction(act_log)
        self.search_box = QtWidgets.QLineEdit()
        self.search_box.setPlaceholderText("搜索")
        self.search_box.textChanged.connect(self.apply_filter)
        tb.addWidget(self.search_box)
        self.format_box = QtWidgets.QComboBox()
        self.format_box.addItems(["全部", "JPEG", "PNG", "TIFF", "GIF", "BMP", "WEBP", "HEIF"])
        self.format_box.currentIndexChanged.connect(self.apply_filter)
        tb.addWidget(self.format_box)
        self.min_w = QtWidgets.QSpinBox()
        self.min_w.setRange(0, 10000)
        self.min_w.setPrefix("宽≥")
        self.min_w.valueChanged.connect(self.apply_filter)
        tb.addWidget(self.min_w)
        self.min_h = QtWidgets.QSpinBox()
        self.min_h.setRange(0, 10000)
        self.min_h.setPrefix("高≥")
        self.min_h.valueChanged.connect(self.apply_filter)
        tb.addWidget(self.min_h)
        self.status = QtWidgets.QStatusBar()
        self.setStatusBar(self.status)
        splitter = QtWidgets.QSplitter()
        self.setCentralWidget(splitter)
        self.class_panel = ClassificationPanel()
        splitter.addWidget(self.class_panel)
        self.grid = CardGrid(columns=3)
        splitter.addWidget(self.grid)
        splitter.setSizes([250, 950])
        self.class_panel.group_selected.connect(self.on_group_selected)
        self.grid.item_selected.connect(self.on_item_selected)
        self.grid.selection_changed.connect(self.on_selection_changed)
        self.filtered_items: List[Dict[str, Any]] = []
        self.log_view = QtWidgets.QTextEdit()
        self.log_view.setReadOnly(True)
        self.log_dock = QtWidgets.QDockWidget("运行日志", self)
        self.log_dock.setWidget(self.log_view)
        self.addDockWidget(QtCore.Qt.DockWidgetArea.BottomDockWidgetArea, self.log_dock)
        self.log_dock.hide()
        self.logger = get_logger()
        self.log_handler = QtLogHandler(self.log_view)
        self.log_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        self.logger.addHandler(self.log_handler)
        try:
            QtWidgets.QApplication.instance().setProperty("selected_count", 0)
        except Exception:
            pass
        QtGui.QShortcut(QtGui.QKeySequence("Ctrl+C"), self).activated.connect(self.on_copy)
        QtGui.QShortcut(QtGui.QKeySequence("Delete"), self).activated.connect(self.on_delete)

    def on_open_folder(self):
        dlg = QtWidgets.QFileDialog(self)
        dlg.setFileMode(QtWidgets.QFileDialog.FileMode.Directory)
        dlg.setOption(QtWidgets.QFileDialog.Option.ShowDirsOnly, True)
        if dlg.exec():
            dirs = dlg.selectedFiles()
            if dirs:
                self.load_root(dirs[0])

    def load_root(self, root: str):
        self.status.showMessage("扫描中...")
        QtWidgets.QApplication.setOverrideCursor(QtCore.Qt.CursorShape.WaitCursor)
        QtWidgets.QApplication.processEvents()
        self.logger.info("开始扫描: %s", root)
        self.items = scan_directory(root)
        self.root = root
        QtWidgets.QApplication.restoreOverrideCursor()
        self.status.showMessage(f"已加载 {len(self.items)} 项")
        self.logger.info("完成扫描: %d 项", len(self.items))
        self.class_panel.set_items(self.items)
        self.filtered_items = self.items
        self.grid.set_items(self.filtered_items)

    def on_group_selected(self, filtered: List[Dict[str, Any]]):
        self.filtered_items = filtered
        self.apply_filter()
        try:
            self.grid.scroll.verticalScrollBar().setValue(0)
        except Exception:
            pass

    def on_item_selected(self, item: Dict[str, Any]):
        pass

    def on_selection_changed(self, count: int):
        total = len(self.filtered_items or [])
        self.status.showMessage(f"已选 {count} / 总计 {total}")

    def on_copy(self):
        self.grid.copy_selected()
        count = len(getattr(self.grid, "_selected", set()))
        total = len(self.filtered_items or [])
        self.status.showMessage(f"已复制 {count} 项 / 总计 {total}")

    def on_delete(self):
        self.grid.delete_selected()
        total = len(self.filtered_items or [])
        self.status.showMessage(f"已选 0 / 总计 {total}")

    def on_refresh(self):
        if self.root:
            self.load_root(self.root)

    def apply_filter(self):
        base = self.filtered_items or []
        text = (self.search_box.text() or "").strip().lower()
        fmt = self.format_box.currentText()
        mw = self.min_w.value()
        mh = self.min_h.value()
        def match(it: Dict[str, Any]) -> bool:
            if fmt != "全部" and str(it.get("format")) != fmt:
                return False
            w = it.get("width") or 0
            h = it.get("height") or 0
            if w < mw or h < mh:
                return False
            if text:
                hay = [str(it.get("path")), str(it.get("rel_path"))]
                exif = it.get("exif") or {}
                iptc = it.get("iptc") or {}
                for v in exif.values():
                    hay.append(str(v))
                for v in iptc.values():
                    hay.append(str(v))
                joined = " \u200b ".join(hay).lower()
                if text not in joined:
                    return False
            return True
        out = [it for it in base if match(it)]
        self.grid.set_items(out)
        self.status.showMessage(f"筛选 {len(out)} / {len(base)} 项")
        if base:
            self.logger.info("筛选结果: %d/%d", len(out), len(base))
        try:
            self.grid.scroll.verticalScrollBar().setValue(0)
        except Exception:
            pass

    def on_export_groups(self):
        if not self.items:
            return
        from services.classifier import group_by_folder, group_by_time, group_by_year, group_by_desc_segments, group_by_tags, export_groups
        mode = self.class_panel.mode_box.currentText()
        if mode == "文件夹":
            groups = group_by_folder(self.items)
        elif mode == "时间":
            groups = group_by_time(self.items)
        elif mode == "年份":
            groups = group_by_year(self.items)
        elif mode == "备注":
            groups = group_by_desc_segments(self.items)
        elif mode == "标签":
            groups = group_by_tags(self.items)
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, "保存分组", self.root or "", "JSON (*.json)")
        if path:
            export_groups(groups, path)
            self.status.showMessage(f"已导出分组 {len(groups)}")

    def on_toggle_log(self, on: bool):
        if on:
            self.log_dock.show()
        else:
            self.log_dock.hide()
