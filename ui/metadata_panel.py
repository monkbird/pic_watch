from typing import Dict, Any
from PySide6 import QtWidgets
import time

LABELS_BASE = {
    "path": "路径",
    "format": "格式",
    "width": "宽度",
    "height": "高度",
    "pages": "页数",
    "file_size": "文件大小",
    "mtime": "修改时间",
    "ctime": "创建时间",
}

LABELS_EXIF = {
    "BitsPerSample": "每像素位数",
    "DateTime": "日期时间",
    "DateTimeOriginal": "拍摄时间",
    "ExifOffset": "EXIF偏移",
    "ImageDescription": "图像描述",
    "ImageLength": "图像高度",
    "ImageWidth": "图像宽度",
    "Make": "相机品牌",
    "Model": "相机型号",
    "Orientation": "方向",
    "ResolutionUnit": "分辨率单位",
    "Software": "软件",
    "XPComment": "注释",
    "XResolution": "水平分辨率",
    "YResolution": "垂直分辨率",
    "YCbCrPositioning": "YCbCr定位",
    "GPSInfo": "GPS信息",
    "Artist": "作者",
}

LABELS_IPTC = {
    "caption/abstract": "说明",
    "Caption": "说明",
    "ObjectName": "对象名",
    "keywords": "关键词",
    "Keywords": "关键词",
}

def _label_base(k: str) -> str:
    return LABELS_BASE.get(k, k)

def _label_exif(k: str) -> str:
    return LABELS_EXIF.get(k, k)

def _label_iptc(k: str) -> str:
    lk = k.lower()
    return LABELS_IPTC.get(k, LABELS_IPTC.get(lk, k))

class MetadataPanel(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.tree = QtWidgets.QTreeWidget()
        self.tree.setHeaderLabels(["字段", "值"])
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(self.tree)

    def _fmt_time(self, v):
        try:
            if isinstance(v, (int, float)):
                t = time.localtime(v)
                return time.strftime("%Y-%m-%d %H:%M:%S", t)
            s = str(v)
            return s
        except Exception:
            return v

    def _fmt_base_value(self, k: str, v):
        if k in ("mtime", "ctime"):
            return self._fmt_time(v)
        return v

    def _fmt_exif_value(self, k: str, v):
        if isinstance(v, str) and k in ("DateTime", "DateTimeOriginal"):
            try:
                parts = v.split(" ", 1)
                date = parts[0].replace(":", "-")
                rest = parts[1] if len(parts) > 1 else ""
                return (date + (" " + rest if rest else "")).strip()
            except Exception:
                return v
        return v

    def set_item(self, item: Dict[str, Any]):
        self.tree.clear()
        def add_pair(parent, k, v):
            it = QtWidgets.QTreeWidgetItem([str(k), str(v)])
            parent.addChild(it)
        basic = QtWidgets.QTreeWidgetItem(["基本", ""])
        self.tree.addTopLevelItem(basic)
        for k in ["path", "format", "width", "height", "pages", "file_size", "mtime", "ctime"]:
            add_pair(basic, _label_base(k), self._fmt_base_value(k, item.get(k)))
        exif_node = QtWidgets.QTreeWidgetItem(["EXIF", ""])
        self.tree.addTopLevelItem(exif_node)
        for k, v in (item.get("exif") or {}).items():
            if isinstance(v, dict):
                tiff_node = QtWidgets.QTreeWidgetItem(["TIFF 标签", ""])
                exif_node.addChild(tiff_node)
                for tk, tv in v.items():
                    add_pair(tiff_node, _label_exif(str(tk)), self._fmt_exif_value(str(tk), tv))
            else:
                add_pair(exif_node, _label_exif(str(k)), self._fmt_exif_value(str(k), v))
        iptc_node = QtWidgets.QTreeWidgetItem(["IPTC", ""])
        self.tree.addTopLevelItem(iptc_node)
        for k, v in (item.get("iptc") or {}).items():
            add_pair(iptc_node, _label_iptc(str(k)), v)
        self.tree.expandItem(basic)
