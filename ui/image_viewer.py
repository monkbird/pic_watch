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

class ImageViewer(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("查看大图")
        self.resize(1000, 700)
        self.label = QtWidgets.QLabel()
        self.label.setAlignment(QtGui.Qt.AlignmentFlag.AlignCenter)
        self.slider = QtWidgets.QSlider(QtGui.Qt.Orientation.Horizontal)
        self.slider.setRange(10, 100)
        self.slider.setValue(100)
        self.slider.valueChanged.connect(self._apply_zoom)
        lay = QtWidgets.QVBoxLayout(self)
        lay.addWidget(self.label)
        lay.addWidget(self.slider)
        self._pm = None

    def _load_pixmap(self, path: str) -> Optional[QtGui.QPixmap]:
        global _heif_registered
        if not path:
            return None
        if not _heif_registered and _pillow_heif is not None:
            try:
                _pillow_heif.register_heif_opener()
                _heif_registered = True
            except Exception:
                pass
        try:
            img = Image.open(path)
        except Exception:
            if _tifffile is not None and str(path).lower().endswith((".tif", ".tiff")):
                try:
                    with _tifffile.TiffFile(path) as tf:
                        arr = tf.pages[0].asarray()
                        img = Image.fromarray(arr)
                except Exception:
                    return None
            else:
                return None
        qimg = ImageQt(img)
        pm = QtGui.QPixmap.fromImage(qimg)
        return pm

    def open_path(self, path: str):
        pm = self._load_pixmap(path)
        if pm is None:
            return
        self._pm = pm
        self._apply_zoom()

    def _apply_zoom(self):
        if self._pm is None:
            return
        lw = max(1, self.label.width())
        lh = max(1, self.label.height())
        fw = lw / self._pm.width()
        fh = lh / self._pm.height()
        fit = min(1.0, min(fw, fh))
        scale = (self.slider.value() / 100.0) * fit
        w = int(self._pm.width() * scale)
        h = int(self._pm.height() * scale)
        spm = self._pm.scaled(w, h, QtGui.Qt.AspectRatioMode.KeepAspectRatio, QtGui.Qt.TransformationMode.SmoothTransformation)
        self.label.setPixmap(spm)

    def resizeEvent(self, e):
        super().resizeEvent(e)
        self._apply_zoom()
