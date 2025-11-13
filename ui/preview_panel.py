from typing import Optional
from PySide6 import QtWidgets, QtGui
from PIL import Image
from PIL.ImageQt import ImageQt
try:
    import tifffile as _tifffile
except Exception:
    _tifffile = None
_heif_registered = False
try:
    import pillow_heif as _pillow_heif
except Exception:
    _pillow_heif = None

class PreviewPanel(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.label = QtWidgets.QLabel()
        self.label.setAlignment(QtGui.Qt.AlignmentFlag.AlignCenter)
        lay = QtWidgets.QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        top = QtWidgets.QHBoxLayout()
        self.page_box = QtWidgets.QSpinBox()
        self.page_box.setMinimum(0)
        self.page_box.setVisible(False)
        self.page_box.valueChanged.connect(self._on_page)
        top.addWidget(QtWidgets.QLabel("页"))
        top.addWidget(self.page_box)
        lay.addLayout(top)
        lay.addWidget(self.label)
        self._item = None

    def _render(self, path: Optional[str], page: int = 0):
        if not path:
            self.label.clear()
            return
        global _heif_registered
        if not _heif_registered and _pillow_heif is not None:
            try:
                _pillow_heif.register_heif_opener()
                _heif_registered = True
            except Exception:
                pass
        try:
            img = Image.open(path)
            qimg = ImageQt(img)
            pm = QtGui.QPixmap.fromImage(qimg)
            self.label.setPixmap(pm.scaled(self.label.size(), QtGui.Qt.AspectRatioMode.KeepAspectRatio, QtGui.Qt.TransformationMode.SmoothTransformation))
            return
        except Exception:
            pass
        if _tifffile is not None and str(path).lower().endswith((".tif", ".tiff")):
            try:
                with _tifffile.TiffFile(path) as tf:
                    page = max(0, min(page, len(tf.pages) - 1))
                    arr = tf.pages[page].asarray()
                    img = Image.fromarray(arr)
                    qimg = ImageQt(img)
                    pm = QtGui.QPixmap.fromImage(qimg)
                    self.label.setPixmap(pm.scaled(self.label.size(), QtGui.Qt.AspectRatioMode.KeepAspectRatio, QtGui.Qt.TransformationMode.SmoothTransformation))
                    return
            except Exception:
                pass
        self.label.clear()

    def set_item(self, item):
        self._item = item
        pages = int(item.get("pages") or 0)
        if pages > 1:
            self.page_box.setMaximum(pages - 1)
            self.page_box.setValue(0)
            self.page_box.setVisible(True)
        else:
            self.page_box.setVisible(False)
        self._render(item.get("path"), 0)

    def _on_page(self, v: int):
        if not self._item:
            return
        self._render(self._item.get("path"), v)
